/***********************
 * CONFIG
 ***********************/
const STORAGE_KEY = 'gallery_images';

/***********************
 * IMAGE DATA (LOAD FROM STORAGE)
 ***********************/
let images = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: 'ZPS13226', date: '2025-09-07', image: 'ZPS13226.jpg' },
    { id: 'ZPS01524', date: '2025-09-07', image: 'ZPS01524.jpg' },
    { id: 'ZPS13210', date: '2025-09-07', image: 'ZPS13210.jpg' }
];

let searchTerm = '';
let selectedCount = 0;

/***********************
 * SAVE TO LOCALSTORAGE
 ***********************/
function saveImages() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
}

/***********************
 * INITIALIZE APP
 ***********************/
function init() {
    renderImages();
    updateStats();
    setupEventListeners();
}

/***********************
 * EVENT LISTENERS
 ***********************/
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const modalClose = document.getElementById('modalClose');
    const imageModal = document.getElementById('imageModal');

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchTerm = e.target.value.toLowerCase();
            renderImages();
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadImages);
    }

    if (fileInput) {
        fileInput.addEventListener('change', e => {
            const count = e.target.files.length;
            document.querySelector('.file-input-label').textContent =
                count > 0 ? `${count} file(s) selected` : 'Choose File';
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (imageModal) {
        imageModal.addEventListener('click', e => {
            if (e.target === imageModal) closeModal();
        });
    }
}

/***********************
 * RENDER IMAGES
 ***********************/
function renderImages() {
    const grid = document.getElementById('imagesGrid');
    const noResults = document.getElementById('noResults');
    if (!grid) return;

    const filtered = images.filter(img =>
        img.id.toLowerCase().includes(searchTerm) ||
        img.date.includes(searchTerm)
    );

    if (filtered.length === 0) {
        grid.style.display = 'none';
        if (noResults) noResults.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    if (noResults) noResults.style.display = 'none';

    grid.innerHTML = filtered.map(img => `
        <div class="image-card">
            <div class="image-container" onclick="openModal('${img.image}')">
                <img src="${img.image}" alt="${img.id}">
            </div>

            <div class="image-info">
                <div class="image-id">${img.id}</div>
                <div class="image-date">${img.date}</div>
            </div>

            <div class="image-actions">
                <button class="edit-btn" onclick="editImage('${img.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteImage('${img.id}')">Delete</button>
            </div>
        </div>
    `).join('');

    document.getElementById('foundImages').textContent = filtered.length;
}

/***********************
 * UPLOAD IMAGES
 ***********************/
function uploadImages() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput || fileInput.files.length === 0) {
        alert('Please select at least one image');
        return;
    }

    const files = Array.from(fileInput.files);
    let uploaded = 0;

    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = e => {
            const name = file.name.replace(/\.[^/.]+$/, '');

            // Prevent duplicate ID
            if (images.some(img => img.id === name)) return;

            images.unshift({
                id: name,
                date: new Date().toISOString().split('T')[0],
                image: e.target.result
            });

            saveImages();
            renderImages();
            updateStats();
            uploaded++;
        };

        reader.readAsDataURL(file);
    });

    fileInput.value = '';
    document.querySelector('.file-input-label').textContent = 'Choose File';

    setTimeout(() => {
        alert(`Successfully uploaded ${uploaded} image(s)!`);
    }, 300);
}

/***********************
 * DELETE IMAGE
 ***********************/
function deleteImage(id) {
    const confirmDelete = confirm(`Are you sure you want to delete ${id}?`);
    if (!confirmDelete) return;

    images = images.filter(img => img.id !== id);

    saveImages();
    renderImages();
    updateStats();
}

/***********************
 * EDIT / RENAME IMAGE
 ***********************/
function editImage(id) {
    const img = images.find(img => img.id === id);
    if (!img) return;

    const newId = prompt('Enter new ID / name:', img.id);
    if (newId === null || newId.trim() === '') return;

    const newDate = prompt('Enter new Date (YYYY-MM-DD):', img.date);
    if (newDate === null || newDate.trim() === '') return;

    // Prevent duplicate ID
    if (images.some(i => i.id === newId && i !== img)) {
        alert('ID already exists! Choose a different name.');
        return;
    }

    img.id = newId.trim();
    img.date = newDate.trim();

    saveImages();
    renderImages();
    updateStats();
}

/***********************
 * STATS
 ***********************/
function updateStats() {
    document.getElementById('totalImages').textContent = images.length;
    document.getElementById('foundImages').textContent = images.length;
    document.getElementById('selectedImages').textContent = selectedCount;
}

/***********************
 * MODAL
 ***********************/
function openModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    if (!modal || !modalImage) return;

    modalImage.src = imageSrc;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.classList.remove('active');
}

/***********************
 * AUTO SAVE ON EXIT
 ***********************/
window.addEventListener('beforeunload', saveImages);

/***********************
 * START APP
 ***********************/
init();
