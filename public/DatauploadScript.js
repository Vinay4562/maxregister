// Constants
const API_BASE_URL = 'https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app';
const VOLTAGE_OPTIONS = {
    '400KV': ['400KV MAHESHWARAM-2', '400KV MAHESHWARAM-1', '400KV NARSAPUR-1', '400KV NARSAPUR-2', '400KV KETHIREDDYPALLY-1', '400KV KETHIREDDYPALLY-2', '400KV NIZAMABAD-1', '400KV NIZAMABAD-2'],
    '220KV': ['220KV PARIGI-1', '220KV PARIGI-2', '220KV TANDUR', '220KV GACHIBOWLI-1', '220KV GACHIBOWLI-2', '220KV KETHIREDDYPALLY', '220KV YEDDUMAILARAM-1', '220KV YEDDUMAILARAM-2', '220KV SADASIVAPET-1', '220KV SADASIVAPET-2'],
    'ICTS': ['315MVA ICT-1', '315MVA ICT-2', '315MVA ICT-3', '500MVA ICT-4']
};

// Helper Functions
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = type;
    alertBox.style.display = 'block';
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function convertExcelTimeToTimeString(excelTime) {
    const totalMinutes = excelTime * 24 * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

async function fetchDataFromServer(endpoint, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

function displayData(data) {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="6" style="text-align: center;">No Data Available</td>`;
        tableBody.appendChild(noDataRow);
    } else {
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.feeder}</td>
                <td>${item.MW}</td>
                <td>${formatDate(item.date)}</td>
                <td>${item.time}</td>
                <td class="action-btns">
                    <span class="btn btn-sm btn-primary" onclick="openEditModal('${item._id}', '${item.MW}', '${item.date}', '${item.time}')">Edit</span>
                    <span class="btn btn-sm btn-danger" onclick="deleteData('${item._id}')">Delete</span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    document.getElementById('uploadedData').style.display = 'block';
}

// Event Listeners
document.getElementById('excelFileInput').addEventListener('change', handleFileSelect);

document.getElementById('selectForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const voltage = document.getElementById('input1').value;
    const feeder = document.querySelector('#input2Container select').value;
    const year = document.getElementById('year').value;

    if (!voltage || !feeder || !year) {
        showAlert('Please select voltage level, feeder/ICT, and year', 'error');
        return;
    }

    document.getElementById('dataUploadTitle').textContent = `Upload Data for ${voltage} ${feeder}-(${year})`;
    document.querySelector('.data-upload').style.display = 'block';
    document.getElementById('dataUploadForm').reset();

    try {
        const data = await fetchDataFromServer(`${API_BASE_URL}/data?feeder=${feeder}&year=${year}`);
        displayData(data);
    } catch (error) {
        showAlert('Failed to fetch data. Please try again.', 'error');
    }
});

document.getElementById('dataUploadForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const MW = document.getElementById('dataInput1').value;
    const date = document.getElementById('dataInput2').value;
    const time = document.getElementById('dataInput3').value;
    const feeder = document.querySelector('#input2Container select').value;
    const year = document.getElementById('year').value;

    if (!MW || !date || !time) {
        showAlert('Please fill all fields.', 'error');
        return;
    }

    try {
        const response = await fetchDataFromServer(`${API_BASE_URL}/upload`, 'POST', { feeder, year, voltage: document.getElementById('input1').value, MW, date, time });
        if (response.error) {
            showAlert(response.error, 'error');
        } else {
            showAlert('Data uploaded successfully!', 'success');
            document.getElementById('dataUploadForm').reset();
            fetchData();
        }
    } catch (error) {
        showAlert('An error occurred while uploading data. Please try again.', 'error');
    }
});

document.getElementById('editForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const id = document.getElementById('editId').value;
    const MW = document.getElementById('editDataInput1').value;
    const date = document.getElementById('editDataInput2').value;
    const time = document.getElementById('editDataInput3').value;
    const feeder = document.querySelector('#input2Container select').value;
    const year = document.getElementById('year').value;

    try {
        const response = await fetchDataFromServer(`${API_BASE_URL}/update?feeder=${feeder}&year=${year}`, 'PUT', { id, MW, date, time });
        if (response.error) {
            showAlert(response.error, 'error');
        } else {
            showAlert('Data updated successfully!', 'success');
            document.getElementById('editModal').style.display = 'none';
            fetchData();
        }
    } catch (error) {
        showAlert('An error occurred while updating the data. Please try again.', 'error');
    }
});

// File Upload Handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.xlsx')) {
        showAlert('Please upload a valid Excel file.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        for (const row of jsonData) {
            const { MW, Date: excelDate, Time: excelTime } = row;
            const formattedDate = excelDate;
            const formattedTime = convertExcelTimeToTimeString(excelTime);
            const feeder = document.querySelector('#input2Container select').value;
            const year = document.getElementById('year').value;
            const voltage = document.getElementById('input1').value;

            try {
                const response = await fetchDataFromServer(`${API_BASE_URL}/upload`, 'POST', { feeder, year, voltage, MW, date: formattedDate, time: formattedTime });
                if (response.error) {
                    showAlert(response.error, 'error');
                } else {
                    showAlert('Data uploaded successfully!', 'success');
                    fetchData();
                }
            } catch (error) {
                showAlert('An error occurred while uploading data. Please try again.', 'error');
            }
        }
    };

    reader.readAsArrayBuffer(file);
}

// Initialization
window.onload = function () {
    // Populate year dropdown
    const yearSelect = document.getElementById('year');
    for (let year = 2012; year <= new Date().getFullYear(); year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }

    // Populate feeder dropdown based on voltage level
    document.getElementById('input1').addEventListener('change', function () {
        const input1Value = this.value;
        const input2Container = document.getElementById('input2Container');
        input2Container.innerHTML = '';

        if (input1Value in VOLTAGE_OPTIONS) {
            const select = document.createElement('select');
            select.name = 'input2';
            select.id = 'input2';
            VOLTAGE_OPTIONS[input1Value].forEach(optionText => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                select.appendChild(option);
            });
            input2Container.appendChild(select);
            document.getElementById('input2Label').style.display = 'block';
        }
    });

    // Check authentication
    fetch('/check-auth', { credentials: 'include' })
        .then(response => {
            if (!response.ok) window.location.href = '/login.html';
        })
        .catch(() => window.location.href = '/login.html');
};