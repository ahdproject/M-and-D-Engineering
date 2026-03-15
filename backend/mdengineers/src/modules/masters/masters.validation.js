const Joi = require('joi');

const createChemicalSchema = Joi.object({
  name:         Joi.string().max(100).required(),
  unit:         Joi.string().valid('ltr', 'kgs', 'Nos').required(),
  default_rate: Joi.number().min(0).required(),
  hsn_code:     Joi.string().default('9988'),
  gst_rate:     Joi.number().default(18),
});

const updateRateSchema = Joi.object({
  new_rate:       Joi.number().min(0).required(),
  effective_from: Joi.date().iso().required(),
  reason:         Joi.string().max(255).required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false, message: 'Validation failed',
    errors: error.details.map(d => d.message),
  });
  next();
};

module.exports = { createChemicalSchema, updateRateSchema, validate };