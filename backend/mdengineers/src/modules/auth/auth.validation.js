// src/modules/auth/auth.validation.js

const Joi = require('joi');

const loginSchema = Joi.object({
  email:    Joi.string().email().required().messages({
    'string.email': 'Enter a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min':   'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

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

module.exports = { loginSchema, refreshSchema, validate };
