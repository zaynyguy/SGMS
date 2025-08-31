const Joi = require('joi');

const idParam = Joi.number().integer().positive().required();

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const createGoal = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(null, ''),
  groupId: Joi.number().integer().positive().allow(null),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
});

const updateGoal = createGoal.keys({
  status: Joi.string().valid('Not Started','In Progress','Completed','On Hold').optional(),
});

const createTask = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(null, ''),
  assigneeId: Joi.number().integer().positive().allow(null),
  dueDate: Joi.date().iso().allow(null),
});

const updateTask = createTask.keys({
  status: Joi.string().valid('To Do','In Progress','Done','Blocked').optional(),
});

const createActivity = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(null, ''),
  metrics: Joi.object().unknown(true).default({}),
  dueDate: Joi.date().iso().allow(null),
});

const updateActivity = createActivity.keys({
  status: Joi.string().valid('To Do','In Progress','Done').optional(),
});

function validate(schema, pick='body') {
  return (req, res, next) => {
    const src = pick === 'params' ? req.params : pick === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(src, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.details[0].message });
    if (pick === 'params') req.params = value;
    else if (pick === 'query') req.query = value;
    else req.body = value;
    next();
  };
}

module.exports = {
  idParam,
  paginationQuery,
  createGoal,
  updateGoal,
  createTask,
  updateTask,
  createActivity,
  updateActivity,
  validate,
};
