const AttendanceModel = require('../models/attendanceModel');
const ClassModel = require('../models/classModel');
const UserModel = require('../models/userModel');
const { hasPermission } = require('../config/rolePermissions');

class DashboardController {
  static summary(req, res, next) {
    try {
      const userCounts = hasPermission(req.user, 'users.read')
        ? UserModel.getAllRaw().reduce((summary, user) => {
          summary.total += 1;
          if (user.status === 'active') summary.active += 1;
          if (user.status === 'pending') summary.pending += 1;
          if (user.status === 'locked') summary.locked += 1;
          return summary;
        }, { total: 0, active: 0, pending: 0, locked: 0 })
        : null;

      const classCounts = hasPermission(req.user, 'classes.read')
        ? ClassModel.list().reduce((summary, item) => {
          summary.total += 1;
          if (item.status === 'active') summary.active += 1;
          if (item.needsHandover) summary.handoverRequired += 1;
          return summary;
        }, { total: 0, active: 0, handoverRequired: 0 })
        : null;

      const attendanceCounts = hasPermission(req.user, 'attendance.read')
        ? AttendanceModel.summaryForUser(req.user)
        : null;

      return res.status(200).json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          users: userCounts,
          classes: classCounts,
          attendance: attendanceCounts
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = DashboardController;
