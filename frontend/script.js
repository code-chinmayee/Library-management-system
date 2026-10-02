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

function logoutUser() {
  localStorage.removeItem('libraryUser');
  window.location.href = 'login.html';
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

function isUser() {
  return getSessionUser()?.role === 'user';
}

function getCurrentStudentId() {
  const user = getSessionUser();
  if (user?.studentId) return user.studentId;
  if (user?.email === 'user@example.com') return 'STU-USER-001';
  return 'STU-UNKNOWN';
}

function getUserIssueMatches(issue) {
  const user = getSessionUser();
  if (!user) return false;

  const studentId = getCurrentStudentId();
  const studentName = user.name || user.email || '';

  return (
    (issue.studentId && issue.studentId === studentId) ||
    (issue.studentName && issue.studentName.toLowerCase() === studentName.toLowerCase())
  );
}

function getIssueNotification(issue) {
  if (!issue) return 'No notification';

  if (issue.status === 'Pending') {
    if (isAdmin()) {
      return `${issue.studentName || 'A user'} (${issue.studentId || 'no ID'}) requested ${issue.bookTitle}. Review the request.`;
    }
    return `Request sent for ${issue.bookTitle}. Waiting for admin approval.`;
  }

  if (issue.status === 'Issued') {
    if (isUser()) return `Your request for ${issue.bookTitle} was approved.`;
    return `Approved: ${issue.bookTitle} has been issued to ${issue.studentName || 'the student'}.`;
  }

  if (issue.status === 'Returned') {
    return `${issue.bookTitle} was returned successfully.`;
  }

  if (issue.status === 'Rejected') {
    if (isAdmin()) return `Request for ${issue.bookTitle} by ${issue.studentName || 'the user'} was rejected.`;
    return `Request for ${issue.bookTitle} was rejected by admin.`;
  }

  return `${issue.bookTitle} is currently ${issue.status}.`;
}

function getSeenNotifications() {
  const user = getSessionUser();
  const key = `libraryNotificationsSeen:${user?.email || user?.studentId || 'unknown'}`;
  try {
    return { key, seen: JSON.parse(localStorage.getItem(key) || '{}') };
  } catch (error) {
    return { key, seen: {} };
  }
}

function createNotificationBell() {
  const nav = document.querySelector('nav');
  if (!nav || document.getElementById('notificationBell')) return;

  const navActions = document.createElement('div');
  navActions.className = 'nav-actions';

  navActions.innerHTML = `
    <button id="notificationBell" class="icon-button" type="button" aria-label="Notifications">
      <span class="bell-icon">🔔</span>
      <span id="notificationBadge" class="notification-badge">0</span>
    </button>
    <div id="notificationPopup" class="notification-popup hidden" aria-live="polite"></div>
  `;

  nav.appendChild(navActions);

  const bell = document.getElementById('notificationBell');
  const popup = document.getElementById('notificationPopup');

  bell.addEventListener('click', () => {
    const isHidden = popup.classList.contains('hidden');
    popup.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      refreshNotifications({ markSeen: true });
    }
  });

  document.addEventListener('click', (event) => {
    if (!popup || !bell) return;
    if (!popup.contains(event.target) && !bell.contains(event.target)) {
      popup.classList.add('hidden');
    }
  });
}

async function refreshNotifications({ markSeen = false } = {}) {
  const popup = document.getElementById('notificationPopup');
  const badge = document.getElementById('notificationBadge');
  if (!popup || !badge) return;

  try {
    const issues = await getIssues();
    const filtered = isAdmin()
      ? issues
      : issues.filter((issue) => getUserIssueMatches(issue));

    const messages = filtered
      .filter((issue) => ['Pending', 'Issued', 'Rejected', 'Returned'].includes(issue.status))
      .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
      .slice(0, 8);

    const { key, seen } = getSeenNotifications();
    const unread = messages.filter((issue) => seen[issue._id] !== issue.status);
    badge.textContent = String(unread.length);

    if (markSeen) {
      messages.forEach((issue) => {
        seen[issue._id] = issue.status;
      });
      localStorage.setItem(key, JSON.stringify(seen));
      badge.textContent = '0';
    }

    popup.innerHTML = messages.length
      ? messages
          .map(
            (issue) => `
              <div class="notification-item ${issue.status.toLowerCase()}">
                <div class="notification-status">${issue.status}</div>
                <p>${getIssueNotification(issue)}</p>
              </div>
            `
          )
          .join('')
      : '<div class="notification-item empty"><p>No notifications yet.</p></div>';
  } catch (error) {
    popup.innerHTML = '<div class="notification-item empty"><p>Notifications unavailable.</p></div>';
    badge.textContent = '0';
  }
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
    const user = getSessionUser();
    const response = await fetch(`${API_BASE}/dashboard`);
    const stats = await response.json();
    const grid = document.getElementById('statsGrid');
    if (!grid) return;

    if (isUser()) {
      const issues = await getIssues();
      const myIssues = issues.filter((issue) => getUserIssueMatches(issue));
      const issuedCount = myIssues.filter((issue) => issue.status === 'Issued').length;
      const returnedCount = myIssues.filter((issue) => issue.status === 'Returned').length;

      grid.innerHTML = `
        <div class="card"><p class="muted">Books Taken</p><p class="stat">${issuedCount}</p></div>
        <div class="card"><p class="muted">Books Returned</p><p class="stat">${returnedCount}</p></div>
        <div class="card"><p class="muted">Current Borrowing</p><p class="stat">${issuedCount}</p></div>
        <div class="card"><p class="muted">Signed In As</p><p class="stat">${user?.name || 'User'}</p></div>
      `;

      const history = document.getElementById('userHistory');
      const container = document.querySelector('.container');
      if (container) {
        if (history) history.remove();
        const panel = document.createElement('section');
        panel.id = 'userHistory';
        panel.className = 'panel';
        panel.innerHTML = `
          <h2>My Books</h2>
          <div class="notification-list" style="margin-bottom: 1rem;">
            ${
              myIssues.length
                ? myIssues
                    .slice(0, 4)
                    .map((issue) => `<p class="muted">${getIssueNotification(issue)}</p>`)
                    .join('')
                : '<p class="muted">No book activity yet.</p>'
            }
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Issue Date</th>
                <th>Return Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                myIssues.length
                  ? myIssues
                      .map(
                        (issue) => `
                          <tr>
                            <td>${issue.bookTitle}</td>
                            <td>${issue.issueDate}</td>
                            <td>${issue.returnDate || '—'}</td>
                            <td>${issue.status}</td>
                          </tr>
                        `
                      )
                      .join('')
                  : '<tr><td colspan="4">You have not borrowed any books yet.</td></tr>'
              }
            </tbody>
          </table>
        `;
        container.appendChild(panel);
      }
      refreshNotifications();
      return;
    }

    grid.innerHTML = `
      <div class="card"><p class="muted">Total Books</p><p class="stat">${stats.totalBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Available Books</p><p class="stat">${stats.availableBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Issued Books</p><p class="stat">${stats.issuedBooks ?? 0}</p></div>
      <div class="card"><p class="muted">Returned Today</p><p class="stat">${stats.returnedToday ?? 0}</p></div>
      <div class="card"><p class="muted">Total Students</p><p class="stat">${stats.totalStudents ?? 0}</p></div>
      <div class="card"><p class="muted">Signed In As</p><p class="stat">${user?.name || 'User'}</p></div>
    `;
    refreshNotifications();
  } catch (error) {
    showMessage('Unable to load dashboard data.', 'error');
  }
}

async function loadBooks() {
  if (!requireLogin()) return;

  try {
    const container = document.getElementById('booksList');
    if (!container) return;

    if (isUser()) {
      const [books, issues] = await Promise.all([getBooks(), getIssues()]);
      const myIssues = issues.filter((issue) => getUserIssueMatches(issue));

      container.innerHTML = `
        <div class="panel sub-panel">
          <h3>Available Books</h3>
          ${
            books.length
              ? books
                  .map(
                    (book) => `
                      <div class="book-item">
                        <h3>${book.title}</h3>
                        <p><strong>Author:</strong> ${book.author}</p>
                        <p><strong>Category:</strong> ${book.category}</p>
                        <p><strong>Available:</strong> ${book.available}</p>
                        <div class="actions">
                          <button onclick="requestBookFromList('${book._id}')">Request Book</button>
                        </div>
                      </div>
                    `
                  )
                  .join('')
              : '<p class="muted">No books found.</p>'
          }
        </div>
        <div class="panel sub-panel" style="margin-top: 1.5rem;">
          <h3>My Book History</h3>
          ${
            myIssues.length
              ? myIssues
                  .map(
                    (issue) => `
                      <div class="book-item">
                        <h3>${issue.bookTitle}</h3>
                        <p><strong>Status:</strong> ${issue.status}</p>
                        <p><strong>Issue Date:</strong> ${issue.issueDate}</p>
                        <p><strong>Return Date:</strong> ${issue.returnDate || 'Not returned yet'}</p>
                        ${
                          issue.status === 'Issued'
                            ? `<div class="actions"><button onclick="returnBook('${issue._id}')">Return Book</button></div>`
                            : issue.status === 'Pending'
                              ? `<div class="actions"><button class="secondary" disabled>Pending Approval</button></div>`
                              : ''
                        }
                      </div>
                    `
                  )
                  .join('')
              : '<p class="muted">You have not borrowed any books yet.</p>'
          }
        </div>
      `;
      return;
    }

    const books = await getBooks();
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
    refreshNotifications();
  } catch (error) {
    showMessage('Unable to load books.', 'error');
  }
  }
async function searchBooks() {
  if (isUser()) {
    await loadBooks();
    return;
  }

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
  if (isUser()) {
    const select = document.getElementById('bookSelect');
    if (select) select.innerHTML = '<option value="">No book access for your account</option>';
    return;
  }

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
  if (isUser()) {
    showMessage('Users can only view their own borrowing history.', 'error');
    return;
  }
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

    const notificationPanel = document.querySelector('.notification-panel');
    if (notificationPanel) {
      const pending = issues.filter((issue) => issue.status === 'Pending');
      const latest = pending.length ? pending.slice(0, 3) : issues.filter((issue) => issue.status === 'Issued' || issue.status === 'Rejected').slice(0, 3);
      notificationPanel.innerHTML = latest.length
        ? latest.map((issue) => `<p class="muted">${getIssueNotification(issue)}</p>`).join('')
        : '<p class="muted">No notifications yet.</p>';
    }

    tbody.innerHTML = issues
      .map(
        (issue) => `
          <tr>
            <td>${issue.studentName}</td>
            <td>${issue.studentId}</td>
            <td>${issue.bookTitle}</td>
            <td>${issue.issueDate}</td>
            <td class="${issue.status === 'Returned' ? 'status' : issue.status === 'Pending' ? 'status out' : 'status'}">${issue.status}</td>
            <td>
              ${
                issue.status === 'Pending'
                  ? `<div class="actions"><button onclick="approveIssue('${issue._id}')">Approve</button><button class="danger" onclick="rejectIssue('${issue._id}')">Reject</button></div>`
                  : issue.status === 'Issued'
                    ? `<button onclick="returnBook('${issue._id}')">Return Book</button>`
                    : '<span class="muted">Completed</span>'
              }
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

    if (window.location.pathname.includes('books.html')) {
      loadBooks();
    } else if (window.location.pathname.includes('dashboard.html')) {
      loadDashboard();
    } else {
      loadIssuedBooks();
    }
    refreshNotifications();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function approveIssue(id) {
  if (!requireLogin()) return;
  try {
    const response = await fetch(`${API_BASE}/issue/${id}/approve`, { method: 'PUT' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to approve request');
    showMessage('Issue request approved', 'success');
    loadIssuedBooks();
    refreshNotifications();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function rejectIssue(id) {
  if (!requireLogin()) return;
  try {
    const response = await fetch(`${API_BASE}/issue/${id}/reject`, { method: 'PUT' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to reject request');
    showMessage('Issue request rejected', 'success');
    loadIssuedBooks();
    refreshNotifications();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function requestBookFromList(id) {
  if (!requireLogin()) return;
  const user = getSessionUser();
  const payload = {
    studentName: user?.name || 'Library User',
    studentId: getCurrentStudentId(),
    bookId: id,
    issueDate: new Date().toISOString().split('T')[0]
  };

  try {
    const response = await fetch(`${API_BASE}/issue/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to request book');
    showMessage(`Book request sent to admin for ${data.bookTitle || 'approval'}`, 'success');
    document.getElementById('notificationPopup')?.classList.remove('hidden');
    refreshNotifications({ markSeen: true });
    if (window.location.pathname.includes('books.html')) {
      loadBooks();
    }
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function issueBookFromList(id) {
  if (!requireLogin()) return;
  if (isUser()) {
    showMessage('Your account is limited to viewing your own borrowed books.', 'error');
    return;
  }

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

function enforceUserPermissions() {
  const currentUser = getSessionUser();
  if (!currentUser) return;

  if (isUser()) {
    const adminOnlyPages = ['add-book.html', 'issue-book.html', 'return-book.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (adminOnlyPages.includes(currentPage)) {
      window.location.href = 'dashboard.html';
      return;
    }

    const booksLink = document.querySelector('nav a[href="books.html"]');
    if (booksLink) booksLink.textContent = 'My Books';

    const adminLinks = document.querySelectorAll('nav a[href="add-book.html"], nav a[href="issue-book.html"], nav a[href="return-book.html"]');
    adminLinks.forEach((link) => {
      link.style.display = 'none';
    });
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

  if (window.location.pathname.includes('logout.html')) {
    logoutUser();
    return;
  }

  const currentUser = getSessionUser();
  if (!currentUser && window.location.pathname.includes('login.html') === false) {
    window.location.href = 'login.html';
    return;
  }

  if (currentUser && window.location.pathname.includes('login.html')) {
    window.location.href = 'dashboard.html';
    return;
  }

  createNotificationBell();
  refreshNotifications();
  enforceUserPermissions();
});
