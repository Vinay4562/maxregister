document.getElementById('excelFileInput').addEventListener('change', handleFileSelect);

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.xlsx')) {
            alert('Please upload a valid Excel file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Process the jsonData and send it to the server
            jsonData.forEach(row => {
                const { MW, Date: excelDate, Time: excelTime } = row;  // 'Date' remains as-is from Excel

                // Skip date conversion, use the date exactly as it is from the Excel file
                const formattedDate = excelDate; 

                // Convert Excel Time
                const formattedTime = convertExcelTimeToTimeString(excelTime);

                const feeder = document.querySelector('#input2Container select').value;
                const year = document.getElementById('year').value;
                const voltage = document.getElementById('input1').value;

                fetch('https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feeder, year, voltage, MW, date: formattedDate, time: formattedTime })
                }).then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert(data.error);
                        } else {
                            document.getElementById('successModal').style.display = 'block';
                            fetchData();

                            setTimeout(() => {
                                document.getElementById('successModal').style.display = 'none';
                            }, 500);
                        }
                    });
            });
        };

        reader.readAsArrayBuffer(file);
    }

    function convertExcelTimeToTimeString(excelTime) {
        const totalMinutes = excelTime * 24 * 60; // Convert fractional day to total minutes
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    document.getElementById('selectForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting

        const voltage = document.getElementById('input1').value;
        const feeder = document.querySelector('#input2Container select').value;
        const year = document.getElementById('year').value;

        if (!voltage || !feeder || !year) {
            alert('Please select voltage level, feeder/ICT, and year');
            return;
        }

        // Set the title for the data upload container
        const title = `Upload Data for ${voltage} ${feeder}-(${year})`;
        document.getElementById('dataUploadTitle').textContent = title;

        // Show the data upload container
        document.querySelector('.data-upload').style.display = 'block';
        document.getElementById('dataUploadForm').reset(); // Reset form inputs

        // Fetch and display data for the selected feeder and year
        fetchData(voltage, feeder, year);
    });

    document.getElementById('dataUploadForm').addEventListener('submit', function(event) {
        event.preventDefault();

        const MW = document.getElementById('dataInput1').value;
        const date = document.getElementById('dataInput2').value;
        const time = document.getElementById('dataInput3').value;
        const feeder = document.querySelector('#input2Container select').value;
        const year = document.getElementById('year').value;
        const voltage = document.getElementById('input1').value;

        const enteredDate = new Date(date);
        const enteredYear = enteredDate.getFullYear();

        if (year !== enteredYear.toString()) {
            alert('The entered year does not match the selected year.');
            return;
        }

        fetch('https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feeder, year, voltage, MW, date, time })
        }).then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    document.getElementById('successModal').style.display = 'block';
                    document.getElementById('dataUploadForm').reset(); // Reset form inputs
                    fetchData();

                    // Close the success modal after 0.5 seconds
                    setTimeout(() => {
                        document.getElementById('successModal').style.display = 'none';
                    }, 500);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while uploading data. Please try again.');
            });
    });

    // Function to fetch and display data
    function fetchData(voltage, feeder, year) {
        fetchAndDisplayData(voltage, feeder, year, function(data) {
            // Sort the data by date
            data.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Format the dates and display the data
            data.forEach(item => {
                item.date = formatDate(item.date);
            });
            displayData(data); // Display the formatted and sorted data
        });
    }
    
    function fetchData() {
        const feeder = document.querySelector('#input2Container select').value;
        const year = document.getElementById('year').value;
    
        // Fetch the data from the server
        fetch(`https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/data?feeder=${feeder}&year=${year}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                return response.json();
            })
            .then(data => {
                // Sort the data by date
                data.sort((a, b) => new Date(a.date) - new Date(b.date));
    
                // Format the dates
                data.forEach(item => {
                    item.date = formatDate(item.date);
                });
    
                const tableBody = document.querySelector('#dataTable tbody');
                tableBody.innerHTML = ''; // Clear previous data
    
                if (data.length === 0) {
                    // Display "No Data Available" if the data array is empty
                    const noDataRow = document.createElement('tr');
                    noDataRow.innerHTML = `<td colspan="6" style="text-align: center;">No Data Available</td>`;
                    tableBody.appendChild(noDataRow);
                } else {
                    // Populate the table with formatted data
                    data.forEach((item, index) => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                          <td>${index + 1}</td>
                          <td>${feeder}</td>
                          <td>${item.MW}</td>
                          <td>${item.date}</td>
                          <td>${item.time}</td>
                          <td class="action-btns">
                            <span class="btn btn-sm btn-primary" onclick="openEditModal('${item._id}', '${item.MW}', '${item.date}', '${item.time}')">Edit</span>
                            <span class="btn btn-sm btn-danger" onclick="deleteData('${item._id}')">Delete</span>
                          </td>
                        `;
                        tableBody.appendChild(row);
                    });
                }
    
                // Show the uploaded data container
                document.getElementById('uploadedData').style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function openEditModal(id, MW, date, time) {
        document.getElementById('editId').value = id;
        document.getElementById('editDataInput1').value = MW;
        document.getElementById('editDataInput2').value = date;
        document.getElementById('editDataInput3').value = time;
        document.getElementById('editModal').style.display = 'block';
    }

    document.querySelector('#editModal .close').onclick = function() {
        document.getElementById('editModal').style.display = 'none';
    };

    function showAlert(message, type = 'success') {
        const alertBox = document.getElementById('alertBox');
        alertBox.textContent = message;
        alertBox.className = type; // 'success' or 'error'
        alertBox.style.display = 'block';
        
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 1500); // Hide after 1.5 seconds
    }
    
    document.getElementById('editForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission behavior
    
        // Retrieve form values
        const id = document.getElementById('editId').value;
        const MW = document.getElementById('editDataInput1').value;
        const date = document.getElementById('editDataInput2').value;
        const time = document.getElementById('editDataInput3').value;
        const feeder = document.querySelector('#input2Container select').value;
        const year = document.getElementById('year').value;
    
        // Send PUT request to the server
        fetch(`https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/update?feeder=${feeder}&year=${year}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, MW, date, time })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'error'); // Display error message
            } else {
                document.getElementById('editModal').style.display = 'none'; // Hide modal
                showAlert('Data updated successfully!'); // Display success message
                fetchData(); // Refresh data on the page
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('An error occurred while updating the data. Please try again.', 'error'); // Display error message
        });
    });
    

      function deleteData(id) {
        const feeder = document.querySelector('#input2Container select').value;
        const year = document.getElementById('year').value;

        fetch(`https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/delete/${id}?feeder=${feeder}&year=${year}`, {
            method: 'DELETE'
        }).then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error); // Display error message
                } else {
                    document.getElementById('editModal').style.display = 'none';
                    showAlert('Data deleted successfully!'); // Display success message
                    fetchData(); // Refresh data on the page
                }
            }).catch(error => {
                console.error('Error:', error);
                showAlert('An error occurred while deleting the data. Please try again.');
            });
    }
    
    function addOptionsToInput2(options) {
      const input2Container = document.getElementById('input2Container');
      const select = document.createElement('select');
      select.name = 'input2';
      select.id = 'input2';
      options.forEach(optionText => {
        const option = document.createElement('option');
        option.value = optionText;
        option.textContent = optionText;
        select.appendChild(option);
      });
      input2Container.appendChild(select);
    }

    window.onclick = function(event) {
      const modal = document.getElementById('successModal');
      const editModal = document.getElementById('editModal');

      if (event.target == modal) {
        modal.style.display = 'none';
      }

      if (event.target == editModal) {
        editModal.style.display = 'none';
      }
    };

    // Populate year dropdown options
    const yearSelect = document.getElementById('year');
    for (let year = 2012; year <= new Date().getFullYear(); year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }

    document.getElementById('input1').addEventListener('change', function() {
      const input1Value = this.value;
      const feederLabel = document.getElementById('input2Label');
      const input2Container = document.getElementById('input2Container');
      input2Container.innerHTML = ''; // Clear previous options

      if (input1Value === '400KV') {
        addOptionsToInput2(['400KV MAHESHWARAM-2', '400KV MAHESHWARAM-1', '400KV NARSAPUR-1', '400KV NARSAPUR-2', '400KV KETHIREDDYPALLY-1', '400KV KETHIREDDYPALLY-2', '400KV NIZAMABAD-1', '400KV NIZAMABAD-2']);
      } else if (input1Value === '220KV') {
        addOptionsToInput2(['220KV PARIGI-1', '220KV PARIGI-2', '220KV TANDUR', '220KV GACHIBOWLI-1', '220KV GACHIBOWLI-2', '220KV KETHIREDDYPALLY', '220KV YEDDUMAILARAM-1', '220KV YEDDUMAILARAM-2', '220KV SADASIVAPET-1', '220KV SADASIVAPET-2']);
      } else if (input1Value === 'ICTS') {
        addOptionsToInput2(['315MVA ICT-1', '315MVA ICT-2', '315MVA ICT-3', '500MVA ICT-4']);
      }
      feederLabel.style.display = 'block';
    });

    function clearFormInputs() {
      document.getElementById('dataInput1').value = '';
      document.getElementById('dataInput2').value = '';
      document.getElementById('dataInput3').value = '';
    }

  // Check authentication on page load
  window.onload = function() {
    fetch('/check-auth', {
      method: 'GET',
      credentials: 'include'  // Important to include credentials (cookies) in the request
    })
    .then(response => {
      if (!response.ok) {
        // If the response status is not 200 (OK), redirect to the login page
        window.location.href = '/login.html';
      }
    })
    .catch(error => {
      console.error('Error checking authentication:', error);
      window.location.href = '/login.html'; // Redirect to login page on error
    });
  };

  // Prevent back navigation
  function preventBack() {
    window.history.forward();
  }

  // Run the preventBack function immediately
  setTimeout(preventBack, 0);

  // Prevent unloading of the page
  window.onunload = function() { null };