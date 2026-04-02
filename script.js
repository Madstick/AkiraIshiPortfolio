/* ============================================
   THE RELIQUARY - Portfolio Scripts
   ============================================ */

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // Ensure page starts at top
    window.scrollTo(0, 0);
    
    initParticles();
    initNavigation();
    initDescendButton();
    initProjects();
    initGallery();
    initModal();
    initContactForm();
    initFilters();
    initHeroAnimations();
    initMagicalCursor();
    initCardAnimations();
    initMasterScrollHandler();
    initRevealObserver(); // Intersection Observer for reveals
    initVisibilityHandler(); // Pause animations when tab hidden
    initFAQ(); // FAQ accordion
    initKnight(); // Knight chasing cursor animation
    initVaultPassword(); // Vault password input
    initSideProjectExpand(); // Side project card expand
    initMusicPlayer(); // Music player list selection
    initSideProjectFilters(); // Side project category filters
    initProvenanceTree(); // Bitcoin provenance tree
});

/* ============================================
   AMBIENT PARTICLES
   ============================================ */

function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    // Check if mobile/touch device
    const isTouchDevice = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    
    // Reduced count for performance - even fewer on mobile
    const particleCount = isTouchDevice ? 8 : 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = (Math.random() * 100) + '%';
        particle.style.animationDelay = (i * 0.8) + 's';
        container.appendChild(particle);
    }
}

/* ============================================
   NAVIGATION
   ============================================ */

function initDescendButton() {
    const descendBtn = document.getElementById('descend-btn');
    const sections = document.querySelectorAll('.section');
    const header = document.querySelector('.reliquary-header');
    
    if (!descendBtn || sections.length === 0) return;
    
    // Click handler - scroll to next section
    descendBtn.addEventListener('click', function() {
        const scrollPos = window.scrollY + window.innerHeight / 2;
        let currentIndex = -1;
        
        // Find current section
        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
                currentIndex = index;
            }
        });
        
        // Scroll to next section
        const nextIndex = currentIndex + 1;
        if (nextIndex < sections.length) {
            const nextSection = sections[nextIndex];
            const headerHeight = header ? header.offsetHeight : 0;
            const targetPosition = nextSection.offsetTop - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
    
    // Scroll handling moved to initMasterScrollHandler for performance
}

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const header = document.querySelector('.reliquary-header');
    
    // Smooth scroll for nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = header.offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Scroll handling moved to initMasterScrollHandler for performance
}

/* ============================================
   PROJECTS / CHRONICLES
   ============================================ */

let chroniclesExpanded = false;
const FEATURED_COUNT = 3;
const INITIAL_ROW_COUNT = 3; // Show 1 row of 3 initially in regular grid

function initProjects() {
    const featuredGrid = document.getElementById('featured-grid');
    const grid = document.getElementById('projects-grid');
    const expandBtn = document.getElementById('chronicles-expand');
    
    if (!grid || typeof projects === 'undefined') return;
    
    renderChronicles();
    
    // Expand button handler
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            chroniclesExpanded = !chroniclesExpanded;
            
            const expandText = expandBtn.querySelector('.expand-text');
            const category = grid.dataset.filteredCategory || 'all';
            
            if (chroniclesExpanded) {
                // Append remaining cards
                const filteredProjects = category === 'all' 
                    ? projects 
                    : projects.filter(p => p.category === category);
                const regularProjects = filteredProjects.slice(FEATURED_COUNT);
                const currentCount = grid.children.length;
                const remainingProjects = regularProjects.slice(currentCount);
                
                remainingProjects.forEach((project, index) => {
                    const card = createProjectCard(project, currentCount + index + FEATURED_COUNT, false);
                    grid.appendChild(card);
                });
                
                grid.classList.remove('collapsed');
                grid.classList.add('expanded');
                expandText.textContent = 'Show Less';
                expandBtn.classList.add('expanded');
            } else {
                // Collapse - keep cards but hide with CSS
                grid.classList.add('collapsed');
                grid.classList.remove('expanded');
                expandText.textContent = 'Reveal More Chronicles';
                expandBtn.classList.remove('expanded');
                // Scroll back to chronicles section
                document.getElementById('chronicles').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    const galleryGrid = document.querySelector('.gallery-thumbnails');
const galleryExpandBtn = document.getElementById('gallery-expand');

if (galleryGrid && galleryExpandBtn) {
    // Start collapsed on mobile only
    if (window.innerWidth <= 768) {
        galleryGrid.classList.add('collapsed');
    }

    galleryExpandBtn.addEventListener('click', () => {
        const isExpanded = galleryGrid.classList.contains('expanded');

        if (isExpanded) {
            galleryGrid.classList.remove('expanded');
            galleryGrid.classList.add('collapsed');
            galleryExpandBtn.classList.remove('expanded');
            galleryExpandBtn.querySelector('.expand-text').textContent = 'More Gallery';
        } else {
            galleryGrid.classList.remove('collapsed');
            galleryGrid.classList.add('expanded');
            galleryExpandBtn.classList.add('expanded');
            galleryExpandBtn.querySelector('.expand-text').textContent = 'Show Less';
        }
    });
}
}

function renderChronicles() {
    const featuredGrid = document.getElementById('featured-grid');
    const grid = document.getElementById('projects-grid');
    const expandBtn = document.getElementById('chronicles-expand');
    
    if (!featuredGrid || !grid) return;
    
    // Get first 3 projects as featured (most recent)
    const featuredProjects = projects.slice(0, FEATURED_COUNT);
    const regularProjects = projects.slice(FEATURED_COUNT);
    
    // Only re-render featured if empty (first load)
    if (featuredGrid.children.length === 0) {
        featuredProjects.forEach((project, index) => {
            const card = createProjectCard(project, index, true);
            featuredGrid.appendChild(card);
        });
    }
    
    // In collapsed mode: render only first row (INITIAL_ROW_COUNT)
    // In expanded mode: append remaining cards
    if (chroniclesExpanded) {
        // Append remaining cards if not already rendered
        const currentCount = grid.children.length;
        const remainingProjects = regularProjects.slice(currentCount);
        
        remainingProjects.forEach((project, index) => {
            const card = createProjectCard(project, currentCount + index + FEATURED_COUNT, false);
            grid.appendChild(card);
        });
        
        grid.classList.remove('collapsed');
        grid.classList.add('expanded');
    } else {
        // First load or collapse: render only visible cards
        if (grid.children.length === 0) {
            const visibleProjects = regularProjects.slice(0, INITIAL_ROW_COUNT);
            visibleProjects.forEach((project, index) => {
                const card = createProjectCard(project, index + FEATURED_COUNT, false);
                grid.appendChild(card);
            });
        }
        grid.classList.add('collapsed');
        grid.classList.remove('expanded');
    }
    
    // Hide expand button if no more projects to show
    if (expandBtn) {
        if (regularProjects.length <= INITIAL_ROW_COUNT) {
            expandBtn.style.display = 'none';
        } else {
            expandBtn.style.display = 'flex';
        }
    }
}

function createProjectCard(project, index, isFeatured = false) {
    const card = document.createElement('div');
    card.className = 'chronicle-card reveal' + (isFeatured ? ' featured' : '');
    card.style.animationDelay = (index * 0.1) + 's';
    card.dataset.projectId = project.id;
    card.dataset.category = project.category;
    
    let imageUrl = project.imageUrl;
    
    const featuredBanner = isFeatured ? '<span class="featured-banner">Featured</span>' : '';
    
    const l2Tag = project.l2 ? `<span class="chronicle-l2">${project.l2}</span>` : '';
    const onchainTag = project.onchain ? `<span class="chronicle-onchain">${project.onchain}</span>` : '';
    
    card.innerHTML = `
        <div class="chronicle-image-container">
            ${featuredBanner}
            <img src="${imageUrl}" alt="${project.title}" class="chronicle-image" loading="lazy" decoding="async">
        </div>
        <div class="chronicle-content">
            <div class="chronicle-tags">
                <span class="chronicle-category">${project.category}</span>
                ${l2Tag}
                ${onchainTag}
            </div>
            <h3 class="chronicle-title">${project.title}</h3>
            <p class="chronicle-excerpt">${project.description}</p>
            <span class="chronicle-link">View Details ❧</span>
        </div>
    `;
    
    card.addEventListener('click', () => openProjectModal(project));
    
    // Trigger reveal animation
    setTimeout(() => {
        card.classList.add('active');
    }, 100 + index * 100);
    
    return card;
}

/* ============================================
   CATEGORY FILTERS
   ============================================ */

function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            filterProjects(filter);
        });
    });
}

function filterProjects(category) {
    const featuredGrid = document.getElementById('featured-grid');
    const grid = document.getElementById('projects-grid');
    const expandBtn = document.getElementById('chronicles-expand');
    
    if (!featuredGrid || !grid) return;
    
    // Clear grids for new filter
    featuredGrid.innerHTML = '';
    grid.innerHTML = '';
    
    // Filter projects by category
    const filteredProjects = category === 'all' 
        ? projects 
        : projects.filter(p => p.category === category);
    
    // Get featured (first 3 of filtered)
    const featuredProjects = filteredProjects.slice(0, FEATURED_COUNT);
    const regularProjects = filteredProjects.slice(FEATURED_COUNT);
    
    // Render featured
    featuredProjects.forEach((project, index) => {
        const card = createProjectCard(project, index, true);
        featuredGrid.appendChild(card);
    });
    
    // Render only visible regular projects (collapsed: first row, expanded: all)
    const projectsToRender = chroniclesExpanded 
        ? regularProjects 
        : regularProjects.slice(0, INITIAL_ROW_COUNT);
    
    projectsToRender.forEach((project, index) => {
        const card = createProjectCard(project, index + FEATURED_COUNT, false);
        grid.appendChild(card);
    });
    
    // Store filtered projects for expand action
    grid.dataset.filteredCategory = category;
    
    // Apply collapsed/expanded class
    if (chroniclesExpanded) {
        grid.classList.remove('collapsed');
        grid.classList.add('expanded');
    } else {
        grid.classList.add('collapsed');
        grid.classList.remove('expanded');
    }
    
    // Update expand button visibility
    if (expandBtn) {
        if (regularProjects.length <= INITIAL_ROW_COUNT) {
            expandBtn.style.display = 'none';
        } else {
            expandBtn.style.display = 'flex';
        }
    }
}

/* ============================================
   GALLERY
   ============================================ */

function initGallery() {
    const thumbnailsContainer = document.getElementById('gallery-thumbnails');
    const mainImage = document.querySelector('.gallery-featured-img');
    const galleryMain = document.getElementById('gallery-main');
    
    if (!thumbnailsContainer) return;
    
    // Gallery images from gallery folder with links
    const galleryImages = [
        // Four Seasons #89 (featured first)
        { url: 'images/gallery/4seasons_AkiraIshi-89.gif', title: 'Four Seasons #89', link: 'https://gamma.io/ordinals/collections/four-seasons/items' },
        // Technosignatures
        { url: 'images/gallery/Technosignatures.webp', title: 'Technosignatures', link: 'https://technosignatures.xyz/' },
        { url: 'images/gallery/36sengtechno.webp', title: 'Technosignatures #36', link: 'https://technosignatures.xyz/' },
        { url: 'images/gallery/50jamestechno.webp', title: 'Technosignatures #50', link: 'https://technosignatures.xyz/' },
        { url: 'images/gallery/84techno.webp', title: 'Technosignatures #84', link: 'https://technosignatures.xyz/' },
        { url: 'images/gallery/87payjayaverytechno.webp', title: 'Technosignatures #87', link: 'https://technosignatures.xyz/' },
        { url: 'images/gallery/oneofthepioneerstechnosignatures.webp', title: 'One of the Pioneers', link: 'https://technosignatures.xyz/' },
        // 3D Viewer
        { url: 'images/gallery/techno3dviewer.webp', title: 'Technosignatures 3D Viewer', link: 'https://technosignatures.xyz/3d-viewer/3dviewer.html' },
        { url: 'images/gallery/techno3dviewer1.webp', title: 'Technosignatures 3D Viewer', link: 'https://technosignatures.xyz/3d-viewer/3dviewer.html' },
        // Four Seasons (rest)
        { url: 'images/gallery/4seasons_AkiraIshi-11.gif', title: 'Four Seasons #11', link: 'https://gamma.io/ordinals/collections/four-seasons/items' },
        { url: 'images/gallery/4seasons_AkiraIshi-65.gif', title: 'Four Seasons #65', link: 'https://gamma.io/ordinals/collections/four-seasons/items' },
        { url: 'images/gallery/4seasons_AkiraIshi-84.gif', title: 'Four Seasons #84', link: 'https://gamma.io/ordinals/collections/four-seasons/items' },
        { url: 'images/gallery/4seasons_AkiraIshi-9-firstonochrome.gif', title: 'Four Seasons #9 (First Monochrome)', link: 'https://gamma.io/ordinals/collections/four-seasons/items' },
        // Googly Rocks
        { url: 'images/gallery/golden googly rock.webp', title: 'Golden Googly Rock', link: 'https://googlyrocks.com/' },
        { url: 'images/gallery/googly nugget.webp', title: 'Googly Nugget', link: 'https://googlyrocks.com/' },
        { url: 'images/gallery/hat googly rock.webp', title: 'Hat Googly Rock', link: 'https://googlyrocks.com/' },
        // Clear Goal Solana
        { url: 'images/gallery/Clear goal exchange solana.webp', title: 'Clear Goal (Solana)', link: 'https://exchange.art/akira-ishi/nfts' },
        // Songe d'un soir
        { url: 'images/gallery/songe1.webp', title: "Songe d'un soir", link: "https://www.fxhash.xyz/project/songe-d'un-soir" },
        { url: 'images/gallery/songe2.webp', title: "Songe d'un soir", link: "https://www.fxhash.xyz/project/songe-d'un-soir" },
        // What's the Point
        { url: 'images/gallery/whatsthepoint2.webp', title: "What's the Point", link: null },
        { url: 'images/gallery/whatsthepointchickens.webp', title: "What's the Point (Chickens)", link: null },
        // Aodach
        { url: 'images/gallery/aodach1.webp', title: 'Aodach', link: 'https://opensea.io/collection/aodach-akira-ishi' },
        { url: 'images/gallery/aodach22.webp', title: 'Aodach #22', link: 'https://opensea.io/collection/aodach-akira-ishi' },
        // Pumpkin
        { url: 'images/gallery/deconstructedpumkin.webp', title: 'Deconstructed Pumpkin', link: 'https://foundation.app/mint/eth/0x985C142E6E8562C8d1482555005684C676cAD9a4/1' },
        // Exhibitions (no links)
        { url: 'images/gallery/Inscribing-Miami-2024-exhibition.webp', title: 'Inscribing Miami 2024 Exhibition', link: null },
        { url: 'images/gallery/vegas-exhibition.webp', title: 'Vegas 2025 Exhibition', link: null },
        // Calendar (no link)
        { url: 'images/gallery/gammacalendar.webp', title: 'Gamma Calendar Participation Summer Palette', link: null }
    ];
    
    let currentImage = galleryImages[0];
    
    const galleryTitle = document.getElementById('gallery-title');
    const galleryLink = document.getElementById('gallery-link');
    
    // Function to update gallery info
    function updateGalleryInfo(img) {
        if (galleryTitle) galleryTitle.textContent = img.title;
        if (galleryLink) {
            if (img.link) {
                galleryLink.href = img.link;
                galleryLink.style.display = 'inline-block';
            } else {
                galleryLink.style.display = 'none';
            }
        }
    }
    
    // Create thumbnails
    galleryImages.forEach((img, index) => {
        const thumb = document.createElement('img');
        thumb.src = img.url;
        thumb.alt = img.title;
        thumb.className = 'gallery-thumb' + (index === 0 ? ' active' : '');
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        
        thumb.addEventListener('click', function() {
            currentImage = img;
            // Update main image
            mainImage.src = img.url;
            mainImage.alt = img.title;
            
            // Update gallery info
            updateGalleryInfo(img);
            
            // Update active state
            document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
        
        thumbnailsContainer.appendChild(thumb);
    });
    
    // Create lightbox for viewing images bigger
    const lightbox = document.createElement('div');
    lightbox.className = 'gallery-lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="" alt="" class="lightbox-img">
            <button class="lightbox-close">&times;</button>
        </div>
    `;
    document.body.appendChild(lightbox);
    
    const lightboxImg = lightbox.querySelector('.lightbox-img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    
    // Open lightbox on main image click
    galleryMain.addEventListener('click', function() {
        lightboxImg.src = currentImage.url;
        lightboxImg.alt = currentImage.title;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    // Close lightbox function
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Close on X button click
    lightboxClose.addEventListener('click', closeLightbox);
    
    // Close on image click
    lightboxImg.addEventListener('click', closeLightbox);
    
    // Close on backdrop click
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
    
    // Set first image as featured
    if (galleryImages.length > 0) {
        mainImage.src = galleryImages[0].url;
        mainImage.alt = galleryImages[0].title;
        updateGalleryInfo(galleryImages[0]);
    }
}

/* ============================================
   PROJECT MODAL
   ============================================ */

function initModal() {
    const modal = document.getElementById('project-modal');
    const closeBtn = document.getElementById('modal-close');
    
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function openProjectModal(project) {
    const modal = document.getElementById('project-modal');
    
    let imageUrl = project.imageUrl;
    
    // Populate modal content
    document.getElementById('modal-image').src = imageUrl;
    document.getElementById('modal-title').textContent = project.title;
    document.getElementById('modal-category').textContent = project.category;
    
    // L2 layer
    const modalL2 = document.getElementById('modal-l2');
    if (project.l2) {
        modalL2.textContent = project.l2;
        modalL2.style.display = 'inline-block';
    } else {
        modalL2.style.display = 'none';
    }
    
    // Onchain tag
    const modalOnchain = document.getElementById('modal-onchain');
    if (project.onchain) {
        modalOnchain.textContent = project.onchain;
        modalOnchain.style.display = 'inline-block';
    } else {
        modalOnchain.style.display = 'none';
    }
    
    document.getElementById('modal-description').textContent = project.description;
    
    // Features list
    const featuresList = document.getElementById('modal-features-list');
    featuresList.innerHTML = '';
    if (project.features) {
        project.features.forEach(feature => {
            const li = document.createElement('li');
            li.textContent = feature;
            featuresList.appendChild(li);
        });
    }
    
    // Conclusion
    const conclusion = document.getElementById('modal-conclusion');
    conclusion.textContent = project.conclusion || '';
    
    // Link
    const link = document.getElementById('modal-link');
    if (project.link) {
        link.href = project.link;
        link.style.display = 'inline-flex';
    } else {
        link.style.display = 'none';
    }
    
    // Article Link (if exists)
    const articleLink = document.getElementById('modal-article-link');
    if (articleLink) {
        if (project.articleLink) {
            articleLink.href = project.articleLink;
            articleLink.style.display = 'inline-flex';
        } else {
            articleLink.style.display = 'none';
        }
    }
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('project-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

/* ============================================
   CONTACT FORM
   ============================================ */

function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message')
        };
        
        // Validate
        if (!data.name || !data.email || !data.message) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (!isValidEmail(data.email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        // Simulate form submission
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            showNotification('Your message has been sent successfully!', 'success');
            form.reset();
            submitBtn.innerHTML = '<span class="btn-ornament">❧</span> Send Message <span class="btn-ornament">❧</span>';
            submitBtn.disabled = false;
        }, 1500);
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✓' : '✗'}</span>
        <span class="notification-text">${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 1rem 2rem;
        background: ${type === 'success' ? '#2d5a27' : '#8b0000'};
        border: 2px solid #c9a227;
        color: #f4e4bc;
        font-family: 'Cinzel', serif;
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/* ============================================
   SCROLL REVEAL - Now handled by initMasterScrollHandler
   ============================================ */

/* ============================================
   HERO ANIMATIONS
   ============================================ */

function initHeroAnimations() {
    const heroTitle = document.querySelector('.hero-title');
    const heroFrame = document.querySelector('.hero-frame');
    const heroDescription = document.querySelector('.hero-description');
    const heroCta = document.querySelector('.hero-cta');
    
    // Staggered entrance animations
    if (heroFrame) {
        heroFrame.style.opacity = '0';
        heroFrame.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            heroFrame.style.transition = 'all 1s cubic-bezier(0.4, 0, 0.2, 1)';
            heroFrame.style.opacity = '1';
            heroFrame.style.transform = 'scale(1)';
        }, 300);
    }
    
    if (heroTitle) {
        const titleLine = heroTitle.querySelector('.title-line');
        const titleDivider = heroTitle.querySelector('.title-divider');
        const titleSubtitle = heroTitle.querySelector('.title-subtitle');
        
        [titleLine, titleDivider, titleSubtitle].forEach((el, i) => {
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                
                setTimeout(() => {
                    el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 600 + (i * 200));
            }
        });
    }
    
    if (heroDescription) {
        heroDescription.style.opacity = '0';
        setTimeout(() => {
            heroDescription.style.transition = 'opacity 1s ease';
            heroDescription.style.opacity = '1';
        }, 1200);
    }
    
    if (heroCta) {
        heroCta.style.opacity = '0';
        heroCta.style.transform = 'translateY(20px)';
        setTimeout(() => {
            heroCta.style.transition = 'all 0.8s ease';
            heroCta.style.opacity = '1';
            heroCta.style.transform = 'translateY(0)';
        }, 1500);
    }
    
    // Sparkles removed for performance
}

/* ============================================
   MAGICAL CURSOR TRAIL
   ============================================ */

function initMagicalCursor() {
    // Skip on mobile/touch devices
    if (window.matchMedia('(hover: none)').matches) return;
    
    const cursor = document.createElement('img');
    cursor.className = 'magical-cursor';
    cursor.src = 'images/desktop-icons/reliquary/cursor.webp';
    cursor.alt = '';
    document.body.appendChild(cursor);
    
    // Inject minimal cursor styles - GPU accelerated
    const style = document.createElement('style');
    style.textContent = `
        body { cursor: none; }
        a, button, .chronicle-card, .gallery-thumb, .filter-btn { cursor: none; }
        .magical-cursor {
            position: fixed;
            left: 0;
            top: 0;
            width: 32px;
            height: 32px;
            pointer-events: none;
            z-index: 99999;
            will-change: transform;
            backface-visibility: hidden;
        }
        .magical-cursor.hover { transform: scale(1.2); }
        .magical-cursor.click { transform: scale(0.9); }
        @media (max-width: 768px) { 
            body { cursor: auto; }
            .magical-cursor { display: none; } 
        }
    `;
    document.head.appendChild(style);
    
    // Use CSS transform for GPU acceleration
    document.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate3d(${e.clientX - 4}px, ${e.clientY - 4}px, 0)`;
    }, { passive: true });
    
    // Simplified hover detection using event delegation
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('a, button, .chronicle-card, .gallery-thumb, .filter-btn')) {
            cursor.classList.add('hover');
        }
    }, { passive: true });
    
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('a, button, .chronicle-card, .gallery-thumb, .filter-btn')) {
            cursor.classList.remove('hover');
        }
    }, { passive: true });
    
    document.addEventListener('mousedown', () => cursor.classList.add('click'), { passive: true });
    document.addEventListener('mouseup', () => cursor.classList.remove('click'), { passive: true });
}

/* ============================================
   CARD ANIMATIONS
   ============================================ */

function initCardAnimations() {
    const grid = document.getElementById('projects-grid');
    const featuredGrid = document.getElementById('featured-grid');
    
    let activeCard = null;
    let resetTimeout = null;
    
    // Shared tilt handler for both grids
    function handleTiltMove(e) {
        const card = e.target.closest('.chronicle-card');
        if (!card) return;
        
        // Clear any pending reset if we're on a card
        if (resetTimeout) {
            clearTimeout(resetTimeout);
            resetTimeout = null;
        }
        
        // If switching to a different card, reset the previous one
        if (activeCard && activeCard !== card) {
            activeCard.style.transform = '';
        }
        
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transition = 'none';
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        activeCard = card;
    }
    
    function handleTiltOut(e) {
        const card = e.target.closest('.chronicle-card');
        if (!card || !activeCard) return;
        
        // Check if we're actually leaving the card (not just moving to a child)
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && card.contains(relatedTarget)) return;
        
        // Set 0.2s delay before resetting
        resetTimeout = setTimeout(() => {
            if (activeCard) {
                activeCard.style.transition = 'transform 0.3s ease';
                activeCard.style.transform = '';
                activeCard = null;
            }
        }, 200);
    }
    
    function handleTiltLeave() {
        if (resetTimeout) {
            clearTimeout(resetTimeout);
        }
        resetTimeout = setTimeout(() => {
            if (activeCard) {
                activeCard.style.transition = 'transform 0.3s ease';
                activeCard.style.transform = '';
                activeCard = null;
            }
        }, 200);
    }
    
    // Apply to regular grid
    if (grid) {
        grid.addEventListener('mousemove', handleTiltMove, { passive: true });
        grid.addEventListener('mouseout', handleTiltOut, { passive: true });
        grid.addEventListener('mouseleave', handleTiltLeave, { passive: true });
    }
    
    // Apply to featured grid
    if (featuredGrid) {
        featuredGrid.addEventListener('mousemove', handleTiltMove, { passive: true });
        featuredGrid.addEventListener('mouseout', handleTiltOut, { passive: true });
        featuredGrid.addEventListener('mouseleave', handleTiltLeave, { passive: true });
    }
}

/* ============================================
   FAIRY DUST EFFECT - Sparkles on section titles
   ============================================ */

function initFairyDust() {
    // Check if mobile/touch device
    const isTouchDevice = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    
    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'fairy-dust-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const particles = [];
    let isAnimating = false;
    
    // Store title rect for fixed positioning
    let targetRect = null;
    // On mobile, store initial rect and don't update (keeps sparkles fixed)
    let initialRect = null;
    
    class Sparkle {
        constructor(offsetX, offsetY) {
            // Store offset from title rect, not absolute position
            this.offsetX = offsetX + (Math.random() - 0.5) * 20;
            this.offsetY = offsetY + (Math.random() - 0.5) * 10;
            // On mobile, capture the initial position at spawn time
            if (isTouchDevice && initialRect) {
                this.fixedX = initialRect.left + this.offsetX;
                this.fixedY = initialRect.top + this.offsetY;
            }
            this.size = Math.random() * 4 + 2;
            this.maxSize = this.size + Math.random() * 6;
            this.alpha = 0;
            this.maxAlpha = 0.7 + Math.random() * 0.3;
            this.growSpeed = 0.08 + Math.random() * 0.06;
            this.shrinkSpeed = 0.02 + Math.random() * 0.02;
            this.phase = 'grow'; // grow, hold, shrink
            this.holdTime = 10 + Math.random() * 20;
            this.holdCounter = 0;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.1;
            this.driftX = (Math.random() - 0.5) * 0.3;
            this.driftY = -Math.random() * 0.5 - 0.2;
        }
        
        update() {
            this.rotation += this.rotationSpeed;
            this.offsetX += this.driftX;
            this.offsetY += this.driftY;
            
            if (this.phase === 'grow') {
                this.alpha += this.growSpeed;
                this.size += 0.3;
                if (this.alpha >= this.maxAlpha || this.size >= this.maxSize) {
                    this.phase = 'hold';
                    this.alpha = this.maxAlpha;
                }
            } else if (this.phase === 'hold') {
                this.holdCounter++;
                // Twinkle effect
                this.alpha = this.maxAlpha * (0.8 + Math.sin(this.holdCounter * 0.3) * 0.2);
                if (this.holdCounter >= this.holdTime) {
                    this.phase = 'shrink';
                }
            } else {
                this.alpha -= this.shrinkSpeed;
                this.size *= 0.97;
            }
            
            return this.alpha > 0;
        }
        
        // Get current screen position based on title rect
        getScreenPos() {
            // On mobile, use fixed position captured at spawn time
            if (isTouchDevice && this.fixedX !== undefined) {
                return {
                    x: this.fixedX,
                    y: this.fixedY
                };
            }
            if (!targetRect) return { x: 0, y: 0 };
            return {
                x: targetRect.left + this.offsetX,
                y: targetRect.top + this.offsetY
            };
        }
        
        draw(ctx) {
            const pos = this.getScreenPos();
            const s = this.size;
            
            ctx.save();
            ctx.globalAlpha = this.alpha;
            
            // Draw 4-point star sparkle
            ctx.translate(pos.x, pos.y);
            ctx.rotate(this.rotation);
            
            const inner = s * 0.3;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const radius = i % 2 === 0 ? s : inner;
                const angle = (i * Math.PI) / 4;
                const px = Math.cos(angle) * radius;
                const py = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            
            // Golden gradient fill
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, '#fff8dc');
            grad.addColorStop(0.7, '#c9a227');
            grad.addColorStop(1, 'rgba(201, 162, 39, 0)');
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Bright center
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            ctx.restore();
        }
    }
    
    // Store reference to current title element
    let targetElement = null;
    
    function render() {
        // Clear with proper scaling
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Scale for retina displays
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Update targetRect each frame to follow scroll (desktop only)
        // On mobile, sparkles use fixed positions so no need to update
        if (targetElement && !isTouchDevice) {
            targetRect = targetElement.getBoundingClientRect();
        }
        
        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            if (!particles[i].update()) {
                particles.splice(i, 1);
            } else {
                particles[i].draw(ctx);
            }
        }
        
        if (particles.length > 0) {
            requestAnimationFrame(render);
        } else {
            isAnimating = false;
            targetElement = null;
            targetRect = null;
        }
    }
    
    // Create sparkles around a title element
    function sparkleTitle(titleEl) {
        if (!titleEl) return;
        
        // Store element reference and get initial rect
        targetElement = titleEl;
        targetRect = titleEl.getBoundingClientRect();
        // On mobile, capture initial rect for fixed sparkle positions
        initialRect = { ...targetRect, left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height };
        
        // Store dimensions at spawn time
        const width = targetRect.width;
        const height = targetRect.height;
        // Reduce sparkle count on mobile for performance
        const sparkleCount = isTouchDevice 
            ? Math.floor(width / 25) + 5 
            : Math.floor(width / 15) + 10;
        
        // Spawn sparkles using offsets from title rect (not absolute positions)
        for (let i = 0; i < sparkleCount; i++) {
            setTimeout(() => {
                // Update targetRect for fresh position (desktop only)
                if (targetElement && !isTouchDevice) {
                    targetRect = targetElement.getBoundingClientRect();
                }
                const offsetX = Math.random() * width;
                const offsetY = Math.random() * height;
                particles.push(new Sparkle(offsetX, offsetY));
            }, i * 30);
        }
        
        if (!isAnimating) {
            isAnimating = true;
            render();
        }
    }
    
    // Track which titles have been sparkled this scroll session
    const sparkledTitles = new WeakSet();
    
    // Observe all section titles directly
    const titles = document.querySelectorAll('h2.section-title, .treasure-title');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                // Sparkle every time title comes into view
                if (!sparkledTitles.has(entry.target)) {
                    sparkleTitle(entry.target);
                    sparkledTitles.add(entry.target);
                }
            } else if (!entry.isIntersecting) {
                // Reset when title leaves view so it can sparkle again
                sparkledTitles.delete(entry.target);
            }
        });
    }, { threshold: [0.5] });
    
    titles.forEach(t => observer.observe(t));
    
    // Expose for manual testing - pass element or selector
    window.sparkleTitle = (el) => {
        if (typeof el === 'string') {
            el = document.querySelector(el);
        }
        sparkleTitle(el);
    };
    
    // Test function
    window.testSparkle = () => {
        const title = document.querySelector('h2.section-title');
        if (title) sparkleTitle(title);
    };
}

document.addEventListener('DOMContentLoaded', initFairyDust);

/* ============================================
   MASTER SCROLL HANDLER - Single throttled scroll listener
   ============================================ */

function initMasterScrollHandler() {
    // Cache all DOM elements once
    const header = document.querySelector('.reliquary-header');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const descendBtn = document.getElementById('descend-btn');
    const progressBar = document.getElementById('scroll-progress');
    
    // Door animation elements
    const treasureSection = document.getElementById('treasure');
    const doorLeft = document.getElementById('door-left');
    const doorRight = document.getElementById('door-right');
    const treasureContent = treasureSection?.querySelector('.treasure-content');
    
    
    // Throttle flag
    let ticking = false;
    
    function onScroll() {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight - windowHeight;
        
        // 1. Header background
        if (header) {
            if (scrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
        
        // 2. Active nav link
        const scrollPos = scrollY + 200;
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
        
        // 3. Descend button visibility
        if (descendBtn && sections.length > 0) {
            const lastSection = sections[sections.length - 1];
            const lastSectionTop = lastSection.offsetTop;
            if (scrollY + windowHeight >= lastSectionTop + windowHeight * 0.5) {
                descendBtn.classList.add('hidden');
            } else {
                descendBtn.classList.remove('hidden');
            }
        }
        
        // 4. Scroll progress bar
        if (progressBar) {
            const scrollPercent = (scrollY / docHeight) * 100;
            progressBar.style.width = scrollPercent + '%';
        }
        
        // 5. Reveal elements - Now handled by initRevealObserver()
        
// 6. Door animation (fast until 40%, then slower until fully open)
if (treasureSection && doorLeft && doorRight) {
    const rect = treasureSection.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;

    const startPoint = isMobile ? windowHeight * 0.6 : windowHeight * 0.6;
    // Extend end point further past the section so doors stay open longer
    const endPoint = isMobile ? -windowHeight * 0.3 : -windowHeight * 1.2;

    let progress = (startPoint - rect.top) / (startPoint - endPoint);
    progress = Math.max(0, Math.min(1, progress));

    let doorProgress;

    // Easing function to slow down the animation (ease-out cubic)
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    
    if (progress <= 0.4) {
        // Reach 55% open by the time scroll reaches 40%
        const normalizedProgress = progress / 0.4;
        doorProgress = easeOutCubic(normalizedProgress) * 0.45;
    } else {
        // Then slowly go from 55% to 100% over the remaining 60% of scroll
        const slowProgress = (progress - 0.4) / 0.6;
        doorProgress = 0.55 + easeOutCubic(slowProgress) * 0.55;
    }

    lastDoorProgress = doorProgress;

    const translateAmount = doorProgress * 100;
    doorLeft.style.transform = `translateX(-${translateAmount}%)`;
    doorRight.style.transform = `translateX(${translateAmount}%)`;

    if (treasureContent) {
        const contentProgress = Math.min(1, doorProgress * 2.5);
        treasureContent.style.opacity = contentProgress;
        treasureContent.style.transform = `scale(${0.9 + contentProgress * 0.1})`;
    }
}
    }
    
    // Single scroll listener with requestAnimationFrame throttling
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                onScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
    
    // Initial call
    onScroll();
}

/* ============================================
   UTILITY ANIMATIONS
   ============================================ */

// Add animation keyframes dynamically
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
    
    .nav-link.active {
        color: #c9a227;
    }
    
    .nav-link.active .nav-icon {
        filter: drop-shadow(0 0 10px rgba(201, 162, 39, 0.7));
    }
    
    .reliquary-header.scrolled {
        background: rgba(26, 15, 5, 0.98);
        box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
    }
`;
document.head.appendChild(styleSheet);

/* ============================================
   INTERSECTION OBSERVER FOR REVEALS
   ============================================ */

function initRevealObserver() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Stop observing once revealed
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -100px 0px' });
    
    revealElements.forEach(el => observer.observe(el));
}

/* ============================================
   VISIBILITY HANDLER - Pause animations when tab hidden
   ============================================ */

function initVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        const particles = document.getElementById('particles');
        const animatedElements = document.querySelectorAll('.shimmer-text, .banner-wave, .treasure-glow, .particle');
        
        if (document.hidden) {
            // Pause all animations when tab is hidden
            animatedElements.forEach(el => {
                el.style.animationPlayState = 'paused';
            });
            if (particles) particles.style.display = 'none';
        } else {
            // Resume animations when tab is visible
            animatedElements.forEach(el => {
                el.style.animationPlayState = 'running';
            });
            if (particles) particles.style.display = 'block';
        }
    });
}

/* ============================================
   FAQ ACCORDION
   ============================================ */

function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isOpen = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isOpen) {
                item.classList.add('active');
            }
        });
    });
}

/* ============================================
   VAULT PASSWORD
   ============================================ */

function initVaultPassword() {
    const input = document.getElementById('vault-password-input');
    const submitBtn = document.getElementById('vault-submit');
    const response = document.getElementById('vault-response');
    
    if (!input || !submitBtn || !response) return;
    
    function showResponse() {
        response.textContent = 'The question is not yet written';
        response.classList.add('show');
        input.value = '';
        
        // Hide after 3 seconds
        setTimeout(() => {
            response.classList.remove('show');
        }, 3000);
    }
    
    submitBtn.addEventListener('click', showResponse);
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            showResponse();
        }
    });
}

/* ============================================
   SIDE PROJECT EXPAND
   ============================================ */

function initSideProjectExpand() {
    const cards = document.querySelectorAll('.side-project-card');
    
    cards.forEach(card => {
        const header = card.querySelector('.side-project-header');
        if (!header) return;
        
        header.addEventListener('click', (e) => {
            // Don't expand if clicking on a link inside
            if (e.target.tagName === 'A') return;
            
            // Close other expanded cards
            cards.forEach(otherCard => {
                if (otherCard !== card && otherCard.classList.contains('expanded')) {
                    otherCard.classList.remove('expanded');
                }
            });
            
            // Toggle current card
            card.classList.toggle('expanded');
        });
    });
}

/* ============================================
   MUSIC PLAYER
   ============================================ */

function initMusicPlayer() {
    const musicItems = document.querySelectorAll('.music-item');
    const videoPlayer = document.getElementById('music-video-player');
    const nowPlaying = document.getElementById('music-now-playing');
    const nftLink = document.getElementById('music-nft-link');
    const videoWrapper = document.querySelector('.video-wrapper');
    
    if (!musicItems.length || !videoPlayer || !nowPlaying) return;
    
    // Check if mobile/touch device
    const isTouchDevice = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    
    // Set initial volume to 30%
    videoPlayer.volume = 0.3;
    
    // Defer video source loading - only load when user interacts
    let videoLoaded = false;
    function loadVideoSource(src) {
        if (!videoPlayer.querySelector('source')) {
            const source = document.createElement('source');
            source.type = 'video/mp4';
            videoPlayer.appendChild(source);
        }
        videoPlayer.querySelector('source').src = src;
        videoPlayer.load();
        videoLoaded = true;
    }
    
    // On mobile, load first video source immediately so it shows
    if (isTouchDevice) {
        const activeItem = document.querySelector('.music-item.active');
        if (activeItem) {
            loadVideoSource(activeItem.getAttribute('data-src'));
        }
    } else {
        // On desktop, load first track source on first play attempt
        videoPlayer.addEventListener('play', () => {
            if (!videoLoaded) {
                const activeItem = document.querySelector('.music-item.active');
                if (activeItem) {
                    loadVideoSource(activeItem.getAttribute('data-src'));
                }
            }
        }, { once: true });
    }
    
    // Only create cursor overlay on non-touch devices (desktop)
    // On mobile, skip overlay so native video controls work properly
    if (videoWrapper && !isTouchDevice) {
        const cursorOverlay = document.createElement('div');
        cursorOverlay.className = 'video-cursor-overlay';
        cursorOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            cursor: none !important;
            z-index: 100;
        `;
        videoWrapper.appendChild(cursorOverlay);
        
        // Forward all mouse events to the video element beneath
        ['click', 'dblclick', 'mousedown', 'mouseup'].forEach(eventType => {
            cursorOverlay.addEventListener(eventType, (e) => {
                cursorOverlay.style.pointerEvents = 'none';
                const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
                cursorOverlay.style.pointerEvents = 'auto';
                
                if (elementBelow && elementBelow !== cursorOverlay) {
                    const newEvent = new MouseEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    elementBelow.dispatchEvent(newEvent);
                }
            });
        });
    }
    
    musicItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active state
            musicItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Get video source, title, and NFT link
            const src = item.getAttribute('data-src');
            const title = item.textContent;
            const nftUrl = item.getAttribute('data-nft');
            
            // Update video player using deferred loading
            loadVideoSource(src);
            videoPlayer.play();
            
            // Update now playing text
            nowPlaying.textContent = 'Now Playing: ' + title;
            
            // Update NFT link
            if (nftLink && nftUrl) {
                nftLink.href = nftUrl;
            }
        });
    });
}

/* ============================================
   KNIGHT CHASING CURSOR ANIMATION
   ============================================ */

function initKnight() {
    // Skip on mobile/touch devices or small screens
    if (window.matchMedia('(hover: none)').matches || window.innerWidth <= 768) return;
    
    // Create knight element
    const knight = document.createElement('img');
    knight.className = 'knight-character';
    knight.alt = 'Knight';
    document.body.appendChild(knight);
    
    // Knight image paths
    const images = {
        standing: 'images/knight/standing1.webp',
        ready: 'images/knight/ready.webp',
        walking: [
            'images/knight/walking1.webp',
            'images/knight/walking2.webp',
            'images/knight/walking3.webp',
            'images/knight/walking4.webp'
        ],
        ded: 'images/knight/ded.webp',
        victory: 'images/knight/victory.webp'
    };
    
    // Preload images
    Object.values(images).flat().forEach(src => {
        const img = new Image();
        img.src = src;
    });
    
    // Knight state
    let knightX = 50; // Start at left edge
    let knightY = window.innerHeight - 100; // Start near bottom
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let state = 'idle'; // idle, standing, ready, walking, ded, victory
    let walkFrame = 0;
    let chaseStartTime = 0;
    let frameCounter = 0;
    let cursorMoved = false; // Track if cursor has moved
    let cursorMovedAfterPose = false; // Track if cursor moved after victory/ded pose
    let lastCursorX = cursorX; // Track cursor position for movement detection
    let lastCursorY = cursorY;
    const CHASE_TIMEOUT = 10000; // 10 seconds
    const DED_DURATION = 3000; // 3 seconds
    const VICTORY_DURATION = 2000; // 2 seconds
    const CATCH_DISTANCE = 60; // pixels to catch cursor
    const BASE_SPEED = 1.5; // slower base movement speed
    const FRAME_DELAY = 16; // slower frames between walk animation changes
    
    // Inject knight styles - GPU accelerated
    const style = document.createElement('style');
    style.textContent = `
        .knight-character {
            position: fixed;
            left: 0;
            top: 0;
            width: 64px;
            height: auto;
            z-index: 10001;
            pointer-events: none;
            image-rendering: pixelated;
            will-change: transform;
            backface-visibility: hidden;
        }
    `;
    document.head.appendChild(style);
    
    // Helper to update knight position with GPU-accelerated transform
    function updateKnightPosition() {
        const scaleX = knight.classList.contains('flipped') ? -1 : 1;
        knight.style.transform = `translate3d(${knightX}px, ${knightY}px, 0) scaleX(${scaleX})`;
    }
    
    // Track cursor position and detect first movement
    document.addEventListener('mousemove', (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
        
        // Start cycle on first cursor movement
        if (!cursorMoved && state === 'idle') {
            cursorMoved = true;
            startCycle();
        }
        
        // Detect cursor movement after victory/ded pose (need significant movement)
        if ((state === 'victory' || state === 'ded') && !cursorMovedAfterPose) {
            const dx = cursorX - lastCursorX;
            const dy = cursorY - lastCursorY;
            if (Math.sqrt(dx * dx + dy * dy) > 30) {
                cursorMovedAfterPose = true;
            }
        }
        
        lastCursorX = cursorX;
        lastCursorY = cursorY;
    }, { passive: true });
    
    // Set knight image
    function setKnightImage(src) {
        knight.src = src;
    }
    
    // Start the knight cycle
    function startCycle() {
        state = 'standing';
        setKnightImage(images.standing);
        // Stay at last position (where victory/ded happened), don't reset to initial
        // Update flip based on cursor position
        if (cursorX > knightX + 32) {
            knight.classList.add('flipped');
        } else {
            knight.classList.remove('flipped');
        }
        updateKnightPosition();
        
        // After 1 second, go to ready
        setTimeout(() => {
            state = 'ready';
            setKnightImage(images.ready);
            
            // After 0.5 seconds, start walking
            setTimeout(() => {
                state = 'walking';
                chaseStartTime = Date.now();
                walkFrame = 0;
                frameCounter = 0;
                runChaseLoop();
            }, 500);
        }, 1000);
    }
    
    // Wait for cursor movement before restarting cycle (with fallback timeout)
    function waitForCursorThenRestart() {
        const poseStartTime = Date.now();
        const maxWaitTime = state === 'victory' ? VICTORY_DURATION : DED_DURATION;
        
        function checkCursorMoved() {
            const elapsed = Date.now() - poseStartTime;
            // Restart if cursor moved OR if max wait time exceeded
            if (cursorMovedAfterPose || elapsed >= maxWaitTime) {
                startCycle();
            } else {
                requestAnimationFrame(checkCursorMoved);
            }
        }
        checkCursorMoved();
    }
    
    // Main chase loop
    function runChaseLoop() {
        if (state !== 'walking') return;
        
        const elapsed = Date.now() - chaseStartTime;
        
        // Check timeout
        if (elapsed >= CHASE_TIMEOUT) {
            state = 'ded';
            setKnightImage(images.ded);
            cursorMovedAfterPose = false;
            waitForCursorThenRestart();
            return;
        }
        
        // Calculate distance to cursor (2D diagonal distance)
        const knightCenterX = knightX + 32;
        const knightCenterY = knightY + 32;
        const deltaX = cursorX - knightCenterX;
        const deltaY = cursorY - knightCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Check if caught cursor
        if (distance < CATCH_DISTANCE) {
            state = 'victory';
            setKnightImage(images.victory);
            cursorMovedAfterPose = false;
            waitForCursorThenRestart();
            return;
        }
        
        // Calculate speed (slower when closer)
        const maxDistance = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight);
        const speedMultiplier = Math.max(0.2, distance / maxDistance);
        const speed = BASE_SPEED * speedMultiplier;
        
        // Normalize direction and move diagonally
        if (distance > 0) {
            const dirX = deltaX / distance;
            const dirY = deltaY / distance;
            knightX += dirX * speed;
            knightY += dirY * speed;
        }
        
        // Flip based on horizontal direction (reversed: flipped when going right, normal when going left)
        if (deltaX > 0) {
            knight.classList.add('flipped');
        } else {
            knight.classList.remove('flipped');
        }
        
        // Keep knight on screen
        knightX = Math.max(0, Math.min(window.innerWidth - 64, knightX));
        knightY = Math.max(0, Math.min(window.innerHeight - 64, knightY));
        updateKnightPosition();
        
        // Update walk animation frame
        frameCounter++;
        if (frameCounter >= FRAME_DELAY) {
            frameCounter = 0;
            walkFrame = (walkFrame + 1) % 4;
            setKnightImage(images.walking[walkFrame]);
        }
        
        animationFrame = requestAnimationFrame(runChaseLoop);
    }
    
    // Initialize - hide knight until cursor moves
    setKnightImage(images.standing);
    updateKnightPosition();
    knight.style.opacity = '0';
    
    // Knight becomes visible when cycle starts
    function showKnight() {
        knight.style.opacity = '1';
    }
    
    // Override startCycle to show knight on first run
    const originalStartCycle = startCycle;
    startCycle = function() {
        showKnight();
        originalStartCycle();
    };
}

/* ============================================
   SIDE PROJECT FILTERS
   ============================================ */

function initSideProjectFilters() {
    const filterBtns = document.querySelectorAll('.side-filter-btn');
    const grid = document.getElementById('side-projects-grid');
    
    if (!filterBtns.length || !grid) return;
    
    const cards = grid.querySelectorAll('.side-project-card');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            
            // Filter cards
            cards.forEach(card => {
                const type = card.dataset.type;
                if (filter === 'all' || type === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

/* ============================================
   PROVENANCE TREE - Grid-based layout
   ============================================ */

function initProvenanceTree() {
    const container = document.getElementById('provenance-tree');
    if (!container) return;
    
    // Node data with grid positions (row, col) - col 0 is center, negative cols go left
    // parentId links nodes for branch drawing
    const nodes = [
        // Row 1: Roots (Four Seasons center, Volker Seal right - no parent)
        { id: '80979178', title: 'Four Seasons', children: '128 children', image: 'images/tree/4seasonstree.webp', link: 'https://gamma.io/ordinals/collections/four-seasons', row: 1, col: 0, isRoot: true },
        { id: '84070307', title: 'Völker Artist Seal', image: 'images/tree/volker.webp', link: 'https://ordinals.com/inscription/84070307', row: 2, col: 2, isRoot: true },
        
        // Row 2: Akira Seal (center)
        { id: '83979554', title: 'Akira Ishi Artist Seal', image: 'images/tree/akira seal.webp', link: 'https://ordinals.com/inscription/83979554', row: 2, col: 0, parentId: '80979178' },
        
        // Row 3: Children of Akira + Main Code (child of both Akira and Volker)
        { id: '90172797', title: 'Prints (Editions)', image: 'images/tree/prints.webp', link: 'https://ordinals.com/inscription/90172797', row: 3, col: -2, parentId: '83979554' },
        { id: '106846686', title: '1/1', image: 'images/tree/oneone.webp', link: 'https://ordinals.com/inscription/106846686', row: 3, col: 0, parentId: '83979554' },
        { id: '85153943', title: 'Technosignatures Main Code', image: '', link: 'https://ordinals.com/inscription/85153943', row: 3, col: 2, parentIds: ['83979554', '84070307'], isCode: true },
        
        // Row 4: Children of Prints (left side) + Pumpkin (child of 1/1)
        { id: '90186667', title: 'Navigating the Trenches', image: 'images/tree/navigatingtree.webp', link: 'https://ordinals.com/inscription/90186667', row: 4, col: -3, parentId: '90172797' },
        { id: '114964852', title: 'Connecting', image: 'images/tree/connectingtree.webp', link: 'https://ordinals.com/inscription/114964852', row: 4, col: -1, parentId: '90172797' },
        { id: '108715264', title: 'Pumpkin', image: 'images/tree/pumpkintree.webp', link: 'https://ordinals.com/inscription/108715264', row: 4, col: 0, parentId: '106846686' },
        
        // Technosignatures (child of Main Code)
        { id: '85158696', title: 'Technosignatures', children: '128 children', image: 'images/tree/technosignaturestree.webp', link: 'https://technosignatures.xyz', row: 4, col: 2, parentId: '85153943' },
        
        // Row 5: 4 Pioneers (children of Main Code)
        { id: '86357837', title: 'Pioneer', image: 'images/tree/pioneer86357837.webp', link: 'https://ordinals.com/inscription/86357837', row: 5, col: 3, parentIds: [ '85153943','85158696'] },
        { id: '86312943', title: 'Pioneer', image: 'images/tree/pioneer86312943.webp', link: 'https://ordinals.com/inscription/86312943', row: 5, col: 4, parentIds: [ '85153943','85158696'] },
        { id: '86187846', title: 'Pioneer', image: 'images/tree/pioneer86187846.webp', link: 'https://ordinals.com/inscription/86187846', row: 5, col: 5, parentIds: [ '85153943','85158696'] },
        { id: '86291765', title: 'Pioneer', image: 'images/tree/pioneer86291765.webp', link: 'https://ordinals.com/inscription/86291765', row: 5, col: 6, parentIds: [ '85153943','85158696'] },
        
        // Row 6: Special Tribute (child of all 4 pioneers + main code)
        { id: '87721327', title: 'Special Tribute', image: 'images/tree/specialinscriptiontree.webp', link: 'https://ordinals.com/inscription/87721327', row: 6, col: 7, parentIds: ['85153943', '86357837', '86312943', '86187846', '86291765'] }
    ];
    
    // Calculate grid bounds - center around col 0
    const minCol = Math.min(...nodes.map(n => n.col));
    const maxCol = Math.max(...nodes.map(n => n.col));
    const maxRow = Math.max(...nodes.map(n => n.row));
    
    // Calculate columns needed on each side of center (col 0)
    const colsLeft = Math.abs(minCol);
    const colsRight = maxCol;
    // Use the larger side to make grid symmetric around center
    const maxSide = Math.max(colsLeft, colsRight);
    const totalCols = maxSide * 2 + 1; // Equal columns on both sides + center
    const centerCol = maxSide + 1; // 1-indexed center column
    
    // Build grid HTML with SVG for branches - use CSS custom properties for responsive sizing
    // Add extra row at top for title
    let html = `<div class="tree-grid" style="grid-template-columns: repeat(${totalCols}, var(--node-size)); grid-template-rows: auto repeat(${maxRow}, calc(var(--node-size) + var(--grid-gap)));">`;
    html += `<svg class="tree-branches"></svg>`;
    // Add title centered at column 0 (centerCol)
    html += `<h3 class="provenance-title" style="grid-row: 1; grid-column: ${centerCol};">Bitcoin Provenance Tree</h3>`;
    
    nodes.forEach(node => {
        const nodeData = JSON.stringify({ id: node.id, title: node.title, image: node.image, link: node.link }).replace(/"/g, '&quot;');
        const rootClass = node.isRoot ? ' root' : '';
        const codeClass = node.isCode ? ' code-node' : '';
        const gridCol = node.col + centerCol; // col 0 maps to centerCol
        // Support both single parentId and multiple parentIds
        const parentData = node.parentIds ? node.parentIds.join(',') : (node.parentId || '');
        const bgStyle = node.image ? `background-image: url('${node.image}');` : '';
        
        html += `
            <div class="tree-node${rootClass}${codeClass}" data-node="${nodeData}" data-id="${node.id}" data-parents="${parentData}" style="grid-row: ${node.row + 1}; grid-column: ${gridCol}; ${bgStyle}">
                ${node.isCode ? '<span class="code-text">CODE</span>' : ''}
                <div class="node-info">
                    <span class="node-title">${node.title}</span>
                    <span class="node-id">#${node.id}</span>
                    ${node.children ? `<span class="node-children">${node.children}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Draw branch connections
    function drawBranches() {
        const svg = container.querySelector('.tree-branches');
        const grid = container.querySelector('.tree-grid');
        if (!svg || !grid) return;
        
        svg.setAttribute('width', grid.scrollWidth);
        svg.setAttribute('height', grid.scrollHeight);
        svg.innerHTML = '';
        
        const nodeElements = container.querySelectorAll('.tree-node[data-parents]');
        nodeElements.forEach(nodeEl => {
            const parentsData = nodeEl.dataset.parents;
            if (!parentsData) return;
            
            // Support multiple parents (comma-separated)
            const parentIds = parentsData.split(',').filter(id => id);
            
            parentIds.forEach(parentId => {
                const parentEl = container.querySelector(`[data-id="${parentId}"]`);
                if (!parentEl) return;
                
                // Use offsetLeft/offsetTop - relative to grid (their offsetParent)
                const x1 = parentEl.offsetLeft + parentEl.offsetWidth / 2;
                const y1 = parentEl.offsetTop + parentEl.offsetHeight;
                const x2 = nodeEl.offsetLeft + nodeEl.offsetWidth / 2;
                const y2 = nodeEl.offsetTop;
                
                let path;
                if (Math.abs(x1 - x2) < 2) {
                    // Straight vertical line
                    path = `M ${x1} ${y1} L ${x2} ${y2}`;
                } else if (parentId === '85153943') {
                    // Main Code to Special Tribute: horizontal first, then vertical
                    path = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
                } else {
                    // L-shaped: down from parent, horizontal, then down to child
                    const midY = (y1 + y2) / 2;
                    path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
                }
                
                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', path);
                pathEl.setAttribute('class', 'tree-branch');
                svg.appendChild(pathEl);
            });
        });
    }
    
    // Draw branches after layout and on resize
    setTimeout(() => {
        drawBranches();
        // Center the scrollbar horizontally
        const scrollWidth = container.scrollWidth - container.clientWidth;
        if (scrollWidth > 0) {
            container.scrollLeft = scrollWidth / 2;
        }
    }, 100);
    window.addEventListener('resize', drawBranches);
    
    // Redraw when tree becomes visible and center scroll
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            setTimeout(() => {
                drawBranches();
                // Center the scrollbar horizontally
                const scrollWidth = container.scrollWidth - container.clientWidth;
                if (scrollWidth > 0) {
                    container.scrollLeft = scrollWidth / 2;
                }
            }, 50);
        }
    }, { threshold: 0.1 });
    observer.observe(container);
    
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'tree-node-popup';
    popup.innerHTML = `
        <button class="popup-close">&times;</button>
        <img class="popup-image" src="" alt="">
        <div class="popup-info">
            <h4 class="popup-title"></h4>
            <span class="popup-id"></span>
            <a class="popup-link" href="" target="_blank">Link →</a>
        </div>
    `;
    document.body.appendChild(popup);
    
    // Click handler for nodes
    container.addEventListener('click', (e) => {
        const node = e.target.closest('[data-node]');
        if (!node) return;
        
        const data = JSON.parse(node.dataset.node);
        
        popup.querySelector('.popup-image').src = data.image || '';
        popup.querySelector('.popup-title').textContent = data.title;
        popup.querySelector('.popup-id').textContent = '#' + data.id;
        popup.querySelector('.popup-link').href = data.link || '#';
        
        popup.classList.add('active');
    });
    
    // Close popup
    popup.querySelector('.popup-close').addEventListener('click', () => {
        popup.classList.remove('active');
    });
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.classList.remove('active');
        }
    });
}
