import './App.css';
import { BulkEnrollment } from './features/02-bulk-enrollment-selection-ui/BulkEnrollment';
import type {
  EnrollmentClass,
  EnrollmentStudent,
} from './features/02-bulk-enrollment-selection-ui/BulkEnrollment';

const students: EnrollmentStudent[] = [
  { id: 101, name: 'Nguyễn Văn An', email: 'an.nguyen@school.edu' },
  { id: 102, name: 'Trần Thị Bình', email: 'binh.tran@school.edu' },
  { id: 103, name: 'Lê Hoàng Cường', email: 'cuong.le@school.edu' },
  { id: 104, name: 'Phạm Mai Duyên', email: 'duyen.pham@school.edu' },
  { id: 105, name: 'Hoàng Quốc Em', email: 'em.hoang@school.edu' },
];

const classes: EnrollmentClass[] = [
  { id: 1, name: 'Lập trình web cơ bản' },
  { id: 2, name: 'Cơ sở dữ liệu' },
  { id: 3, name: 'Kỹ thuật phần mềm' },
];

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-kicker">Demo UI</p>
        <h1>Giao diện ghi danh học viên</h1>
      </header>

      <BulkEnrollment
        students={students}
        classes={classes}
        endpoint="/api/enrollments/bulk"
      />
    </main>
  );
}

export default App;
