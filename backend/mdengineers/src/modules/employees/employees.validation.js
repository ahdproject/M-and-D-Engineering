const Joi = require('joi');

const createEmployeeSchema = Joi.object({
  name:         Joi.string().min(2).max(100).required(),
  phone:        Joi.string().max(15).optional(),
  designation:  Joi.string().max(100).optional(),
  joining_date: Joi.date().iso().optional(),
});

const updateEmployeeSchema = Joi.object({
  name:         Joi.string().min(2).max(100).optional(),
  phone:        Joi.string().max(15).optional(),
  designation:  Joi.string().max(100).optional(),
  joining_date: Joi.date().iso().optional(),
  is_active:    Joi.boolean().optional(),
});

const salaryConfigSchema = Joi.object({
  default_daily_hours:  Joi.number().min(1).max(24).required(),
  hourly_rate:          Joi.number().min(0).required(),
  overtime_multiplier:  Joi.number().min(1).max(5).default(1.5),
  effective_from:       Joi.date().iso().required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false, message: 'Validation failed',
    errors: error.details.map(d => d.message),
  });
  next();
};

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  salaryConfigSchema,
  validate,
};