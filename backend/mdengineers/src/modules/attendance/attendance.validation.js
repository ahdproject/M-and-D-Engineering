const Joi = require('joi');

const markAttendanceSchema = Joi.object({
  date:    Joi.date().iso().required(),
  records: Joi.array().items(
    Joi.object({
      employee_id:     Joi.number().integer().positive().required(),
      status:          Joi.string().valid('present','absent','half_day','holiday','leave').required(),
      check_in:        Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      check_out:       Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      actual_hours:    Joi.number().min(0).max(24).optional(),
      overtime_hours:  Joi.number().min(0).max(12).optional(),
      ot_remark:       Joi.string().max(255).optional(),
    })
  ).min(1).required(),
});

const updateAttendanceSchema = Joi.object({
  status:         Joi.string().valid('present','absent','half_day','holiday','leave').optional(),
  check_in:       Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  check_out:      Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  actual_hours:   Joi.number().min(0).max(24).optional(),
  overtime_hours: Joi.number().min(0).max(12).optional(),
  ot_remark:      Joi.string().max(255).optional(),
});

const addOvertimeSchema = Joi.object({
  employee_id:    Joi.number().integer().positive().required(),
  date:           Joi.date().iso().required(),
  overtime_hours: Joi.number().min(0.5).max(12).required(),
  ot_remark:      Joi.string().max(255).required(),
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
  markAttendanceSchema,
  updateAttendanceSchema,
  addOvertimeSchema,
  validate,
};