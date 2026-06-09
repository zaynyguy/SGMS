// src/utils/validator.js

const Joi = require("joi");

const idParam = Joi.number().integer().positive().required();

const trimmedString = () => Joi.string().trim();
const trimmedText = () => Joi.string().trim().allow(null, "");
const nonEmptyText = () => Joi.string().trim().min(1).max(255);

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const authLogin = Joi.object({
  username: nonEmptyText().max(255).required(),
  password: trimmedString().min(1).max(512).required(),
});

const createUser = Joi.object({
  username: nonEmptyText().max(255).required(),
  name: trimmedText().max(255),
  password: trimmedString().min(6).max(512).required(),
  roleId: Joi.number().integer().positive().allow(null),
  language: Joi.string().trim().min(2).max(10).default("en"),
  profilePicture: trimmedText().max(1024),
});

const updateUser = Joi.object({
  username: trimmedString().min(1).max(255).optional(),
  name: trimmedText().max(255),
  password: trimmedString().min(6).max(512).optional(),
  roleId: Joi.number().integer().positive().allow(null),
  language: Joi.string().trim().min(2).max(10).optional(),
  profilePicture: trimmedText().max(1024).optional(),
});

const createGoal = Joi.object({
  title: nonEmptyText().max(255).required(),
  description: trimmedText(),
  groupId: Joi.number().integer().positive().allow(null),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
});

const updateGoal = createGoal.keys({
  status: Joi.string()
    .valid("Not Started", "In Progress", "Completed", "On Hold")
    .optional(),
});

const createTask = Joi.object({
  title: nonEmptyText().max(255).required(),
  description: trimmedText(),
  assigneeId: Joi.number().integer().positive().allow(null),
  dueDate: Joi.date().iso().allow(null),
});

const updateTask = createTask.keys({
  status: Joi.string()
    .valid("To Do", "In Progress", "Done", "Blocked")
    .optional(),
});

const createActivity = Joi.object({
  title: nonEmptyText().max(255).required(),
  description: trimmedText(),
  metrics: Joi.object().unknown(true).default({}),
  dueDate: Joi.date().iso().allow(null),
});

const updateActivity = createActivity.keys({
  status: Joi.string().valid("To Do", "In Progress", "Done").optional(),
});

function validate(schema, pick = "body") {
  return (req, res, next) => {
    const src =
      pick === "params" ? req.params : pick === "query" ? req.query : req.body;
    const { error, value } = schema.validate(src, { stripUnknown: true });
    if (error)
      return res.status(400).json({ message: error.details[0].message });
    if (pick === "params") req.params = value;
    else if (pick === "query") req.query = value;
    else req.body = value;
    next();
  };
}

module.exports = {
  idParam,
  paginationQuery,
  authLogin,
  createUser,
  updateUser,
  createGoal,
  updateGoal,
  createTask,
  updateTask,
  createActivity,
  updateActivity,
  validate,
};
