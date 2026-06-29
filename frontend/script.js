const API_BASE = '';

function showMessage(text, type = 'success') {
  const message = document.getElementById('message');
  if (!message) return;
  message.className = `alert ${type}`;
  message.textContent = text;
}

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('libraryUser'));
  } catch (error) {
    return null;
  }
}

function requireLogin() {
  const user = getSessionUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function isAdmin() {
  return getSessionUser()?.role === 'admin';
}

function getBooks() {
  return fetch(`${API_BASE}/books`).then((res) => res.json());
}

function getIssues() {
  return fetch(`${API_BASE}/issue`).then((res) => res.json());
}

async function loadDashboard() {
  if (!requireLogin()) return;
  try {
    const response = await fetch(`${API_BASE}/dashboard`);
    const stats = await response.json();
    const grid = document.getElementById('statsGrid');
    if (!grid) return;
    const user = getSessionUser();
    grid.innerHTML = `
      <div class="card"><p class="muted">Total Books</p><p class="stat">${stats.totalBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Available Books</p><p class="stat">${stats.availableBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Issued Books</p><p class="stat">${stats.issuedBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Returned Today</p><p class="stat">${stats.returnedToday ?? 0}</p></div>
      <div class="card"><p class="muted">Total Students</p><p class="stat">${stats.totalStudents ?? 0}</p></div>
      <div class="card"><p class="muted">Signed In As</p><p class="stat">${user?.name || 'User'}</p></div>
    `;
  } catch (error) {
    showMessage('Unable to load dashboard data.', 'error');
  }
}

async function loadBooks() {
  if (!requireLogin()) return;
  try {
    const books = await getBooks();
    const container = document.getElementById('booksList');
    if (!container) return;

    if (!books.length) {
      container.innerHTML = '<p class="muted">No books found.</p>';
      return;
    }

    container.innerHTML = books
      .map(
        (book) => `
          <div class="book-item">
            <h3>${book.title}</h3>
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${book.category}</p>
            <p><strong>Available:</strong> ${book.available}</p>
            <div class="actions">
              <button onclick="issueBookFromList('${book._id}')">Issue Now</button>
              ${isAdmin() ? `<button class="secondary" onclick="editBook('${book._id}')">Edit</button>` : ''}
              ${isAdmin() ? `<button class="danger" onclick="deleteBook('${book._id}')">Delete</button>` : ''}
            </div>
          </div>
        `
      )
      .join('');
  } catch (error) {
    showMessage('Unable to load books.', 'error');
  }
}

async function searchBooks() {
  const term = document.getElementById('searchInput').value;
  try {
    const books = await fetch(`${API_BASE}/books?search=${encodeURIComponent(term)}`).then((res) => res.json());
    const container = document.getElementById('booksList');
    if (!container) return;
    if (!books.length) {
      container.innerHTML = '<p class="muted">No matching books found.</p>';
      return;
    }
    container.innerHTML = books
      .map(
        (book) => `
          <div class="book-item">
            <h3>${book.title}</h3>
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${book.category}</p>
            <p><strong>Available:</strong> ${book.available}</p>
            <div class="actions">
              <button onclick="issueBookFromList('${book._id}')">Issue Now</button>
              <button class="secondary" onclick="editBook('${book._id}')">Edit</button>
              <button class="danger" onclick="deleteBook('${book._id}')">Delete</button>
            </div>
          </div>
        `
      )
      .join('');
  } catch (error) {
    showMessage('Search failed.', 'error');
  }
}

async function submitAddBookForm(event) {
  if (!requireLogin()) return;
  if (!isAdmin()) {
    showMessage('Only admins can add books.', 'error');
    return;
  }
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.year = Number(payload.year);
  payload.quantity = Number(payload.quantity);

  try {
    const response = await fetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to add book');
    showMessage(`Book added successfully: ${data.title}`, 'success');
    form.reset();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function populateBookSelect() {
  try {
    const books = await getBooks();
    const select = document.getElementById('bookSelect');
    if (!select) return;
    select.innerHTML = books
      .filter((book) => Number(book.available) > 0)
      .map((book) => `<option value="${book._id}">${book.title} (${book.available} available)</option>`)
      .join('');
  } catch (error) {
    showMessage('Unable to load books for issuance.', 'error');
  }
}

async function submitIssueBookForm(event) {
  if (!requireLogin()) return;
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.issueDate = payload.issueDate || new Date().toISOString().split('T')[0];

  try {
    const response = await fetch(`${API_BASE}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to issue book');
    showMessage(`Book issued to ${data.studentName}`, 'success');
    form.reset();
    populateBookSelect();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function loadIssuedBooks() {
  if (!requireLogin()) return;
  try {
    const issues = await getIssues();
    const tbody = document.getElementById('returnTableBody');
    if (!tbody) return;
    tbody.innerHTML = issues
      .map(
        (issue) => `
          <tr>
            <td>${issue.studentName}</td>
            <td>${issue.studentId}</td>
            <td>${issue.bookTitle}</td>
            <td>${issue.issueDate}</td>
            <td class="${issue.status === 'Returned' ? 'status' : 'status out'}">${issue.status}</td>
            <td>
              ${issue.status === 'Issued' ? `<button onclick="returnBook('${issue._id}')">Return Book</button>` : '<span class="muted">Returned</span>'}
            </td>
          </tr>
        `
      )
      .join('');
  } catch (error) {
    showMessage('Unable to load issued books.', 'error');
  }
}

async function returnBook(id) {
  if (!requireLogin()) return;
  try {
    const response = await fetch(`${API_BASE}/return/${id}`, { method: 'PUT' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to return book');
    showMessage('Book returned successfully', 'success');
    loadIssuedBooks();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function issueBookFromList(id) {
  if (!requireLogin()) return;

  const studentName = window.prompt('Student Name', 'Student');
  if (!studentName) return;

  const studentId = window.prompt('Student ID', 'STU001');
  if (!studentId) return;

  const issueDate = new Date().toISOString().split('T')[0];

  try {
    const response = await fetch(`${API_BASE}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, studentId, bookId: id, issueDate })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to issue book');
    showMessage(`Book issued to ${studentName}`, 'success');
    if (window.location.pathname.includes('books.html')) {
      loadBooks();
    }
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function editBook(id) {
  if (!requireLogin()) return;
  if (!isAdmin()) {
    showMessage('Only admins can edit books.', 'error');
    return;
  }
  const book = await fetch(`${API_BASE}/books/${id}`).then((res) => res.json());
  const title = prompt('Edit title', book.title);
  const author = prompt('Edit author', book.author);
  const category = prompt('Edit category', book.category);
  const quantity = prompt('Edit quantity', book.quantity);

  if (title === null || author === null || category === null || quantity === null) return;

  try {
    const response = await fetch(`${API_BASE}/books/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, category, quantity })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to update book');
    showMessage('Book updated successfully', 'success');
    loadBooks();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function deleteBook(id) {
  if (!requireLogin()) return;
  if (!isAdmin()) {
    showMessage('Only admins can delete books.', 'error');
    return;
  }
  if (!confirm('Delete this book?')) return;
  try {
    const response = await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to delete book');
    showMessage('Book deleted successfully', 'success');
    loadBooks();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function submitLoginForm(event) {
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    localStorage.setItem('libraryUser', JSON.stringify(data));
    window.location.href = 'dashboard.html';
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const bookId = params.get('bookId');
  if (bookId) {
    const select = document.getElementById('bookSelect');
    if (select) {
      populateBookSelect().then(() => {
        select.value = bookId;
      });
    }
  }

  const currentUser = getSessionUser();
  if (!currentUser && window.location.pathname.includes('login.html') === false) {
    window.location.href = 'login.html';
  }
});
