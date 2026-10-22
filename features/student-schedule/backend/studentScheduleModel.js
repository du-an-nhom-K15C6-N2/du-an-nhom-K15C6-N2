
const ClassModel = require('../../../backend/models/classModel');
const EnrollmentModel = require('../../../backend/models/enrollmentModel');

const enrollmentModel = new EnrollmentModel();



function parseSchedule(schedule) {
    let text = String(schedule || '').normalize('NFC');

    // Sửa chuỗi bị lỗi mã hóa nếu cần
    if (text.includes('Thá»') || text.includes('â€¢')) {
        try {
            const bytes = Uint8Array.from(
                [...text].map(char => char.charCodeAt(0) & 255)
            );
            text = new TextDecoder('utf-8').decode(bytes);
        } catch (error) {
            // Nếu không khôi phục được, dùng chuỗi ban đầu
        }
    }

    // Tìm thứ học: Thứ 2 đến Thứ 7
    const dayMatch = text.match(
        /(?:Thứ|Thá»©)\s*([2-7])/i
    );

    // Tìm khoảng thời gian, hỗ trợ cả dấu phân cách bị lỗi
    const timeMatch = text.match(
        /(\d{1,2}):(\d{2})[\s\S]*?(\d{1,2}):(\d{2})/
    );

    if (!dayMatch || !timeMatch) return null;

    const sh = Number(timeMatch[1]);
    const sm = Number(timeMatch[2]);
    const eh = Number(timeMatch[3]);
    const em = Number(timeMatch[4]);

    if (
        sh > 23 || eh > 23 ||
        sm > 59 || em > 59
    ) {
        return null;
    }

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (endMinutes <= startMinutes) return null;

    return {
        dayOfWeek: Number(dayMatch[1]) - 1,
        startMinutes,
        endMinutes
    };
}


function dateAtMidnight(value) {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildSessions(classItem, fromDate, toDate) {
    const parsed = parseSchedule(classItem.schedule);
    if (!parsed) return [];

    const sessions = [];

    for (
        let day = dateAtMidnight(fromDate);
        day <= toDate;
        day.setDate(day.getDate() + 1)
    ) {
        if (day.getDay() !== parsed.dayOfWeek) continue;

        const dateString = [
            day.getFullYear(),
            String(day.getMonth() + 1).padStart(2, '0'),
            String(day.getDate()).padStart(2, '0')
        ].join('-');

        if (dateString < classItem.startDate ||
            dateString > classItem.endDate) {
            continue;
        }

        const start = new Date(day);
        start.setMinutes(parsed.startMinutes);

        const end = new Date(day);
        end.setMinutes(parsed.endMinutes);

        sessions.push({
            classId: classItem.id,
            classCode: classItem.code,
            className: classItem.name,
            room: classItem.room || '',
            date: dateString,
            startTime: start.toTimeString().slice(0, 5),
            endTime: end.toTimeString().slice(0, 5),
            startAt: start.toISOString(),
            endAt: end.toISOString()
        });
    }

    return sessions;
}

function getStudentSchedule(studentId, now = new Date()) {
    const enrollments = enrollmentModel.readStore().enrollments;

    const classIds = new Set(
        enrollments
            .filter(item => String(item.studentId) === String(studentId))
            .map(item => String(item.classId))
    );

    const classes = ClassModel.list()
        .filter(item => classIds.has(String(item.id)))
        .filter(item => item.status === 'active');

    const weekStart = dateAtMidnight(now);
    const offset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - offset);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weeklySessions = classes
        .flatMap(item => buildSessions(item, weekStart, weekEnd))
        .sort((a, b) => a.startAt.localeCompare(b.startAt));

    const futureEnd = new Date(now);
    futureEnd.setDate(futureEnd.getDate() + 180);

    const nextSession = classes
        .flatMap(item => buildSessions(item, now, futureEnd))
        .filter(item => new Date(item.startAt) > now)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))[0] || null;

    return {
        nextSession,
        weeklySessions
    };
}

module.exports = {
    parseSchedule,
    buildSessions,
    getStudentSchedule
};
