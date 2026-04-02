const svc          = require('./attendance.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const mark      = asyncHandler(async (req, res) => {
  const data = await svc.markAttendance(req.body, req.user.id);
  return ApiResponse.created(res, data, `Attendance marked for ${data.date}`);
});

const getByDate = asyncHandler(async (req, res) => {
  if (!req.query.date) return ApiResponse.error(res, 'date param required', 400);
  const data = await svc.getByDate(req.query.date);
  return ApiResponse.success(res, { date: req.query.date, records: data, total: data.length });
});

const getMonthlyEmployee = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlyForEmployee(req.params.employee_id, month, year);
  return ApiResponse.success(res, data);
});

const getMonthlyAll = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlyAll(month, year);
  return ApiResponse.success(res, { month, year, employees: data, total: data.length });
});

const addOvertime = asyncHandler(async (req, res) => {
  const data = await svc.addOvertime(req.body, req.user.id);
  return ApiResponse.success(res, data, 'Overtime updated');
});

const updateRecord = asyncHandler(async (req, res) => {
  const data = await svc.updateRecord(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Attendance updated');
});

module.exports = { mark, getByDate, getMonthlyEmployee, getMonthlyAll, addOvertime, updateRecord };