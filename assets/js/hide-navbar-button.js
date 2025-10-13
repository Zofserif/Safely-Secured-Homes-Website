// Check if we're on the index page
function isIndexPage() {
    // Get the current page path
    const path = window.location.pathname;

    // Check if we're on index.html or the root
    return path.endsWith('index.html') || 
           path.endsWith('/') || 
           (path.lastIndexOf('/') === path.length - 1);
}

// Get the special button
const specialButton = document.getElementById('specialButton');

// Hide the button if we're not on the index page
if (!isIndexPage()) {
    specialButton.classList.add('visually-hidden');
}