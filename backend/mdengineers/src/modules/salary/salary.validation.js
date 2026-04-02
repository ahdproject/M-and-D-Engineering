const Joi = require('joi');

const computeSalarySchema = Joi.object({
  month:        Joi.number().integer().min(1).max(12).required(),
  year:         Joi.number().integer().min(2020).required(),
  employee_ids: Joi.array().items(Joi.number().integer()).optional(),
  // If employee_ids empty — compute for ALL active employees
});

const markPaidSchema = Joi.object({
  paid_on: Joi.date().iso().required(),
  remarks: Joi.string().max(500).optional(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false, message: 'Validation failed',
    errors: error.details.map(d => d.message),
  });
  next();
};

module.exports = { computeSalarySchema, markPaidSchema, validate };