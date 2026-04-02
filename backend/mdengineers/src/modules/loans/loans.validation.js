const Joi = require('joi');

const createLoanSchema = Joi.object({
  employee_id:      Joi.number().integer().positive().required(),
  loan_amount:      Joi.number().positive().required(),
  tenure_months:    Joi.number().integer().min(1).max(120).required(),
  deduction_start:  Joi.date().iso().required()
                      .messages({ 'any.required': 'deduction_start date is required' }),
  purpose:          Joi.string().max(255).optional(),
  // emi_amount is auto-calculated — not required from client
});

const cancelLoanSchema = Joi.object({
  cancel_reason: Joi.string().max(500).required(),
});

const waiveEmiSchema = Joi.object({
  waive_reason: Joi.string().max(500).required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false, message: 'Validation failed',
    errors: error.details.map(d => d.message),
  });
  next();
};

module.exports = { createLoanSchema, cancelLoanSchema, waiveEmiSchema, validate };