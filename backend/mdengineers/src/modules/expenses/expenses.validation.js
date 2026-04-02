const Joi = require('joi');

const cashExpenseSchema = Joi.object({
  date:         Joi.date().iso().required(),
  category_id:  Joi.number().integer().positive().required(),
  amount:       Joi.number().positive().required(),
  description:  Joi.string().max(500).optional(),
  payment_mode: Joi.string().valid('cash','bank','upi').default('cash'),
  receipt_no:   Joi.string().max(50).optional(),
});

const bulkCashExpenseSchema = Joi.object({
  date:    Joi.date().iso().required(),
  entries: Joi.array().items(
    Joi.object({
      category_id:  Joi.number().integer().positive().required(),
      amount:       Joi.number().positive().required(),
      description:  Joi.string().max(500).optional(),
      payment_mode: Joi.string().valid('cash','bank','upi').default('cash'),
      receipt_no:   Joi.string().max(50).optional(),
    })
  ).min(1).required(),
});

const utilityBillSchema = Joi.object({
  bill_type: Joi.string().max(50).required(),
  amount:    Joi.number().positive().required(),
  bill_date: Joi.date().iso().required(),
  due_date:  Joi.date().iso().optional(),
  month:     Joi.number().integer().min(1).max(12).required(),
  year:      Joi.number().integer().min(2020).required(),
  bill_no:   Joi.string().max(50).optional(),
  remarks:   Joi.string().max(500).optional(),
});

const markUtilityPaidSchema = Joi.object({
  paid_on: Joi.date().iso().required(),
});

const vendorExpenseSchema = Joi.object({
  vendor_name:  Joi.string().max(150).required(),
  amount:       Joi.number().positive().required(),
  date:         Joi.date().iso().required(),
  purpose:      Joi.string().max(500).optional(),
  payment_mode: Joi.string().valid('cash','bank','upi','cheque').default('cash'),
  reference_no: Joi.string().max(50).optional(),
});

const cashReceivedSchema = Joi.object({
  date:    Joi.date().iso().required(),
  amount:  Joi.number().positive().required(),
  source:  Joi.string().max(100).optional(),
  bill_no: Joi.string().max(50).optional(),
  notes:   Joi.string().max(500).optional(),
});

const openingBalanceSchema = Joi.object({
  month:   Joi.number().integer().min(1).max(12).required(),
  year:    Joi.number().integer().min(2020).required(),
  amount:  Joi.number().min(0).required(),
  note:    Joi.string().max(255).optional(),
});

const updateExpenseSchema = Joi.object({
  amount:       Joi.number().positive().optional(),
  description:  Joi.string().max(500).optional(),
  date:         Joi.date().iso().optional(),
  payment_mode: Joi.string().valid('cash','bank','upi').optional(),
  receipt_no:   Joi.string().max(50).optional(),
}).min(1);

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).json({
    success: false, message: 'Validation failed',
    errors: error.details.map(d => d.message),
  });
  next();
};

module.exports = {
  cashExpenseSchema, bulkCashExpenseSchema,
  utilityBillSchema, markUtilityPaidSchema,
  vendorExpenseSchema, cashReceivedSchema,
  openingBalanceSchema, updateExpenseSchema,
  validate,
};
