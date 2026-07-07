const {
  buildQuarterRowsFromActivities,
  getMetricKeyFromActivityRow,
} = require("../helpers/excelParser");
const { buildImportPreview } = require("../helpers/importPreviewGenerator");
const {
  upsertGoal,
  upsertTask,
  upsertActivity,
  upsertQuarterlyRecord,
  applyActivityQuarterlyRecords,
} = require("../controllers/bulkImport.controller");

describe("Bulk import helper tests", () => {
  describe("Quarter row parsing from Activities sheet", () => {
    it("should build quarter rows for planned, actual, and remark cells", () => {
      const rows = [
        {
          activity_id: 1,
          activity_title: "Test Activity",
          activity_target_metric: JSON.stringify({ progress: 0 }),
          q1_planned: 100,
          q1_actual: 50,
          q1_remark: "On track",
        },
      ];

      const quarterRows = buildQuarterRowsFromActivities(rows);

      expect(quarterRows).toHaveLength(1);
      expect(quarterRows[0]).toMatchObject({
        activity_id: 1,
        activity_title: "Test Activity",
        quarter: 1,
        metric_key: "progress",
        planned: 100,
        actual: 50,
        remark: "On track",
        sheetName: "Activities",
      });
    });
  });

  describe("Goal import update handling", () => {
    it("should update title and description when existing goal is found by id", async () => {
      const row = {
        goal_id: 42,
        goal_title: "Updated Goal Title",
        goal_description: "Updated goal description",
      };
      const goalLookup = new Map();
      goalLookup.set("id:42", {
        id: 42,
        title: "Old Goal Title",
        groupId: null,
      });
      const groupLookup = new Map();

      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 42,
                rollNo: null,
                title: "Updated Goal Title",
                groupId: null,
              },
            ],
          }),
      };

      const result = await upsertGoal(client, row, goalLookup, groupLookup);

      expect(result).toEqual({ id: 42, action: "updated" });
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][1]).toEqual([
        null,
        "Updated Goal Title",
        "Updated goal description",
        null,
        null,
        null,
        null,
        null,
        42,
      ]);
    });
  });

  describe("Task import handling", () => {
    it("should update task title and description using existing task lookup", async () => {
      const row = {
        task_id: 21,
        task_title: "Updated Task Title",
        task_description: "Updated task description",
        task_status: "In Progress",
        task_weight: "4",
        task_due_date: "2025-09-30",
      };
      const taskLookup = new Map();
      taskLookup.set("id:21", {
        id: 21,
        title: "Old Task Title",
        goalId: 2,
        rollNo: null,
      });

      const client = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 21 }] }),
      };

      const result = await upsertTask(client, row, 2, taskLookup);

      expect(result).toEqual({ id: 21, action: "updated" });
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][1]).toEqual([
        null,
        "Updated Task Title",
        "Updated task description",
        "In Progress",
        4,
        "2025-09-30",
        null,
        21,
      ]);
    });

    it("should create a new task when no existing task is found", async () => {
      const row = {
        task_title: "New Task",
        task_description: "New task description",
        task_status: "To Do",
        task_weight: "2",
        task_due_date: "2025-10-15",
      };
      const taskLookup = new Map();

      const client = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 99 }] }),
      };

      const result = await upsertTask(client, row, 3, taskLookup);

      expect(result).toEqual({ id: 99, action: "created" });
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][1]).toEqual([
        3,
        null,
        "New Task",
        "New task description",
        "To Do",
        2,
        "2025-10-15",
        null,
      ]);
    });
  });

  describe("Activity import update handling", () => {
    it("should update activity title and description using existing activity lookup", async () => {
      const row = {
        activity_id: 101,
        activity_title: "Updated Activity Title",
        activity_description: "Updated activity description",
        activity_status: "In Progress",
        activity_weight: 5,
        activity_due_date: "2025-12-31",
        activity_metric_type: "Plus",
        activity_target_metric: JSON.stringify({ progress: 100 }),
        activity_current_metric: JSON.stringify({ progress: 10 }),
        activity_previous_metric: JSON.stringify({ progress: 0 }),
      };
      const activityLookup = new Map();
      activityLookup.set("id:101", {
        id: 101,
        title: "Old Activity Title",
        taskId: 11,
        rollNo: null,
        isDone: false,
      });

      const client = {
        query: jest
          .fn()
          // UPDATE Activities - returns updated activity
          .mockResolvedValueOnce({
            rows: [
              {
                id: 101,
                rollNo: null,
                title: "Updated Activity Title",
                taskId: 11,
                isDone: false,
                currentMetric: { progress: 10 },
              },
            ],
          })
          // UPDATE Tasks (from refreshTaskAndGoalProgress)
          .mockResolvedValueOnce({ rows: [] })
          // UPDATE Goals (from refreshTaskAndGoalProgress)
          .mockResolvedValueOnce({ rows: [] }),
      };

      const result = await upsertActivity(client, row, 11, activityLookup);

      expect(result).toEqual({ id: 101, action: "updated" });
      // Now we expect 3 calls: UPDATE Activities, UPDATE Tasks (for progress refresh), UPDATE Goals (for progress refresh)
      expect(client.query).toHaveBeenCalledTimes(3);
      // First call is the UPDATE Activities query
      expect(client.query.mock.calls[0][1][1]).toBe("Updated Activity Title");
      expect(client.query.mock.calls[0][1][2]).toBe(
        "Updated activity description",
      );
    });
  });

  describe("Import preview row matching", () => {
    it("should match existing activities by title when task_id is missing and hydrate quarterly q1..q4 values", async () => {
      const currentFiscalYear = new Date().getFullYear();
      const db = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rows: [{ id: 1, title: "Goal 1", groupId: null, rollNo: null }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 10, title: "Task A", goalId: 1, rollNo: null }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 100,
                title: "Activity X",
                taskId: 10,
                rollNo: null,
                targetMetric: JSON.stringify({ progress: 100 }),
                quarterlyGoals: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ fiscal_year: currentFiscalYear }] })
          .mockResolvedValueOnce({
            rows: [
              { activityId: 100, quarter: 1, metricKey: "progress", value: 42 },
            ],
          }),
      };

      const parsed = {
        goals: [{ goal_title: "Goal 1" }],
        tasks: [{ task_title: "Task A", goal_id: 1 }],
        activities: [{ activity_title: "Activity X" }],
        quarters: [],
      };

      const preview = await buildImportPreview(db, parsed);

      expect(preview.goals.update).toBe(1);
      expect(preview.tasks.update).toBe(1);
      expect(preview.activities.update).toBe(1);
      expect(preview.activitiesPreview).toHaveLength(1);
      expect(preview.activitiesPreview[0].matched).toEqual({
        id: 100,
        title: "Activity X",
        taskId: 10,
        rollNo: null,
        targetMetric: JSON.stringify({ progress: 100 }),
        quarterlyGoals: null,
      });
      expect(preview.activitiesPreview[0].quarterlyRecords).toEqual({
        q1: 42,
        q2: null,
        q3: null,
        q4: null,
      });
    });
  });

  describe("Quarterly import upsert record handling", () => {
    it("should upsert planned, actual, and remark records using the activity metric key", async () => {
      const row = {
        quarter: 1,
        activity_target_metric: JSON.stringify({ progress: 100 }),
        planned: "100",
        actual: "50",
        remark: "Quarter one remark",
      };
      const client = {
        query: jest
          .fn()
          .mockResolvedValue({
            rows: [{ targetMetric: JSON.stringify({ progress: 100 }) }],
          }),
      };

      await upsertQuarterlyRecord(client, row, 5, 99);

      expect(client.query).toHaveBeenCalledTimes(4);
      expect(client.query.mock.calls[0][0]).toContain(
        'SELECT "targetMetric" FROM "Activities"',
      );
      expect(client.query.mock.calls[0][1]).toEqual([5]);
      expect(client.query.mock.calls[1][1]).toEqual([
        5,
        expect.any(Number),
        1,
        "progress_planned",
        100,
        99,
      ]);
      expect(client.query.mock.calls[2][1]).toEqual([
        5,
        expect.any(Number),
        1,
        "progress",
        50,
        99,
      ]);
      expect(client.query.mock.calls[3][1]).toEqual([
        5,
        expect.any(Number),
        1,
        "progress_remark",
        "Quarter one remark",
        99,
      ]);
    });

    it("should use the activity's stored primary metric when quarter rows do not provide metric_key", async () => {
      const row = {
        quarter: 2,
        planned: "200",
        actual: "150",
        remark: "Second quarter update",
      };
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rows: [{ targetMetric: JSON.stringify({ progress: 200 }) }],
          })
          .mockResolvedValue({}),
      };

      await upsertQuarterlyRecord(client, row, 6, 77);

      expect(client.query.mock.calls[0][0]).toContain(
        'SELECT "targetMetric" FROM "Activities"',
      );
      expect(client.query.mock.calls[0][1]).toEqual([6]);
      expect(client.query.mock.calls[1][1]).toEqual([
        6,
        expect.any(Number),
        2,
        "progress_planned",
        200,
        77,
      ]);
      expect(client.query.mock.calls[2][1]).toEqual([
        6,
        expect.any(Number),
        2,
        "progress",
        150,
        77,
      ]);
      expect(client.query.mock.calls[3][1]).toEqual([
        6,
        expect.any(Number),
        2,
        "progress_remark",
        "Second quarter update",
        77,
      ]);
    });

    it("should derive metric key from the activity targetMetric when applying activity quarterly records", async () => {
      const client = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                targetMetric: JSON.stringify({ progress: 100 }),
                metricType: "Plus",
                previousMetric: JSON.stringify({ progress: 0 }),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ fiscal_year: 2025 }] })
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({ rows: [{ quarter: 1, value: 50 }] })
          .mockResolvedValueOnce({}),
      };

      await applyActivityQuarterlyRecords(client, 5, { q1: 50 }, 99);

      expect(client.query.mock.calls[0][0]).toContain(
        'SELECT "targetMetric"\, "metricType"\, "previousMetric" FROM "Activities"',
      );
      expect(client.query.mock.calls[0][1]).toEqual([5]);
      expect(client.query.mock.calls[1][0]).toContain(
        "SELECT * FROM calc_fiscal_period(CURRENT_DATE)",
      );
      expect(client.query.mock.calls[2][1]).toEqual([
        5,
        expect.any(Number),
        1,
        "progress",
        50,
        99,
      ]);
      expect(client.query.mock.calls[3][0]).toContain(
        'SELECT "quarter"\, "value"',
      );
      expect(client.query.mock.calls[3][1]).toEqual([
        5,
        expect.any(Number),
        "progress",
      ]);
      expect(client.query.mock.calls[4][0]).toContain('UPDATE "Activities"');
      expect(client.query.mock.calls[4][1][2]).toBe(5);
    });
  });
});
