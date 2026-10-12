
const API = '/api/students';

const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
const studentList = document.getElementById('studentList');
const detailSection = document.getElementById('detailSection');
const studentForm = document.getElementById('studentForm');
const message = document.getElementById('message');

let selectedStudentId = null;

function showMessage(text) {
    message.textContent = text;
}

async function loadStudents() {
    try {
        const keyword = searchInput.value.trim();

        const response = await fetch(
            `${API}?search=${encodeURIComponent(keyword)}`
        );

        if (!response.ok) {
            throw new Error('Khong tai duoc danh sach');
        }

        const result = await response.json();

        studentList.replaceChildren();

        if (result.data.length === 0) {
            const row = studentList.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = 'Khong tim thay hoc vien';
            return;
        }

        result.data.forEach(student => {
            const row = studentList.insertRow();

            row.insertCell().textContent = student.studentCode;
            row.insertCell().textContent = student.fullName;
            row.insertCell().textContent = student.phone;

            const actionCell = row.insertCell();
            const button = document.createElement('button');

            button.textContent = 'Xem / Sua';
            button.type = 'button';
            button.addEventListener('click', () => {
                viewStudent(student.id);
            });

            actionCell.appendChild(button);
        });

    } catch (error) {
        showMessage('Loi tai danh sach hoc vien');
    }
}

function renderClasses(elementId, classes) {
    const list = document.getElementById(elementId);
    list.replaceChildren();

    if (!classes || classes.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'Chua co du lieu';
        list.appendChild(item);
        return;
    }

    classes.forEach(className => {
        const item = document.createElement('li');
        item.textContent = className;
        list.appendChild(item);
    });
}

async function viewStudent(id) {
    try {
        const response = await fetch(`${API}/${id}`);

        if (!response.ok) {
            throw new Error('Khong tim thay hoc vien');
        }

        const result = await response.json();
        const student = result.data;

        selectedStudentId = student.id;

        document.getElementById('fullName').value =
            student.fullName;

        document.getElementById('phone').value =
            student.phone;

        document.getElementById('entryLevel').value =
            student.entryLevel || '';

        document.getElementById('notes').value =
            student.notes || '';

        renderClasses('currentClasses', student.currentClasses);
        renderClasses('classHistory', student.classHistory);

        detailSection.hidden = false;
        detailSection.scrollIntoView({ behavior: 'smooth' });

        showMessage('');

    } catch (error) {
        showMessage('Khong the xem ho so hoc vien');
    }
}

studentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (selectedStudentId === null) return;

    const updatedStudent = {
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        entryLevel: document.getElementById('entryLevel').value,
        notes: document.getElementById('notes').value
    };

    try {
        const response = await fetch(
            `${API}/${selectedStudentId}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedStudent)
            }
        );

        if (!response.ok) {
            throw new Error('Cap nhat that bai');
        }

        showMessage('Cap nhat ho so thanh cong!');
        await loadStudents();

    } catch (error) {
        showMessage('Loi khi cap nhat ho so');
    }
});

searchBtn.addEventListener('click', loadStudents);

searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        loadStudents();
    }
});

loadStudents();
