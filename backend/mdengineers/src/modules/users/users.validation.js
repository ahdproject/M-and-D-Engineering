const Joi = require('joi');

const createUserSchema = Joi.object({
  name:        Joi.string().min(2).max(100).required(),
  email:       Joi.string().email().required(),
  password:    Joi.string().min(6).required(),
  role_id:     Joi.number().integer().valid(1, 2, 3).required()
               .messages({ 'any.only': 'role_id must be 1(admin), 2(manager) or 3(staff)' }),
  permissions: Joi.array().items(
    Joi.object({
      module:    Joi.string().valid(
                   'stock','pl','salary','attendance',
                   'cash_expense','user_mgmt','masters','work_orders'
                 ).required(),
      can_view:  Joi.boolean().default(true),
      can_edit:  Joi.boolean().default(false),
    })
  ).default([]),
});

const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(
    Joi.object({
      module:   Joi.string().required(),
      can_view: Joi.boolean().required(),
      can_edit: Joi.boolean().required(),
    })
  ).min(1).required(),
  is_active: Joi.boolean(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors:  error.details.map(d => d.message),
  });
  next();
};

module.exports = { createUserSchema, updatePermissionsSchema, validate };