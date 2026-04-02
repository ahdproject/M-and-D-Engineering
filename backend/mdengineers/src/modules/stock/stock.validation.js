const Joi = require('joi');

const singleEntrySchema = Joi.object({
  date:                  Joi.date().iso().required(),
  chemical_id:           Joi.number().integer().positive().required(),
  entry_type:            Joi.string().valid('purchase', 'usage', 'adjustment').required(),
  quantity:              Joi.number().positive().required(),
  quantity_unit:         Joi.string().required(),
  rate:                  Joi.number().min(0).optional(),
  rate_unit:             Joi.string().optional(),
  use_master_rate:       Joi.boolean().default(true),
  rate_override_reason:  Joi.string().max(255).when('use_master_rate', {
                           is: false,
                           then: Joi.required(),
                           otherwise: Joi.optional()
                         }),
  remark:                Joi.string().max(500).allow('').optional(),
});

const bulkEntrySchema = Joi.object({
  date:    Joi.date().iso().required(),
  entries: Joi.array().items(
    Joi.object({
      chemical_id:          Joi.number().integer().positive().required(),
      entry_type:           Joi.string().valid('purchase', 'usage', 'adjustment').required(),
      quantity:             Joi.number().positive().required(),
      quantity_unit:        Joi.string().required(),
      rate:                 Joi.number().min(0).optional(),
      use_master_rate:      Joi.boolean().default(true),
      rate_override_reason: Joi.string().optional().allow(''),
      remark:               Joi.string().optional().allow(''),
    })
  ).min(1).required(),
});

const updateEntrySchema = Joi.object({
  quantity:             Joi.number().positive().optional(),
  rate:                 Joi.number().min(0).optional(),
  entry_type:           Joi.string().valid('purchase', 'usage', 'adjustment').optional(),
  date:                 Joi.date().iso().optional(),
  remark:               Joi.string().max(500).allow('').optional(),
  rate_override_reason: Joi.string().max(255).allow('').optional(),
  change_reason:        Joi.string().max(500).required()
                          .messages({ 'any.required': 'change_reason is required for all edits' }),
}).min(2); // at least one field to change + change_reason

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  error.details.map(d => d.message),
    });
  }
  next();
};

// ✅ All three schemas exported
module.exports = { singleEntrySchema, bulkEntrySchema, updateEntrySchema, validate };