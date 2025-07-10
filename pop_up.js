
// Fonction pour afficher le pop-up
function showPopup() {
    console.log("Contenu chargé, tentative d'affichage du pop-up...");
    document.getElementById('popupOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Fonction pour masquer le pop-up
function hidePopup() {
    document.getElementById('popupOverlay').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Fonction pour charger le contenu de index.html
async function loadIndexContent() {
    try {
        const response = await fetch('index.html');
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // On cible le <body> principal
        const mainContent = doc.querySelector('body') || doc.querySelector('main') || doc.querySelector('.main-content');

        if (mainContent) {
            // Supprimer le header si présent
            const header = mainContent.querySelector('header');
            if (header) header.remove();

            // Supprimer les scripts
            const scripts = mainContent.querySelectorAll('script');
            scripts.forEach(script => script.remove());

            // Supprimer les styles internes
            const styles = mainContent.querySelectorAll('style');
            styles.forEach(style => style.remove());

            // Injecter le HTML nettoyé
            document.getElementById('popupBody').innerHTML = mainContent.innerHTML;
        } else {
            document.getElementById('popupBody').innerHTML = '<p>Impossible de charger le contenu de index.html</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement de index.html:', error);
        document.getElementById('popupBody').innerHTML = '<p>Erreur lors du chargement du contenu.</p>';
    }
}

// Fermer le pop-up en cliquant sur l'overlay
document.getElementById('popupOverlay').addEventListener('click', function (e) {
    if (e.target === this) {
        hidePopup();
    }
});

// Fermer avec la touche Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('popupOverlay').classList.contains('active')) {
        hidePopup();
    }
});

// Charger le contenu et afficher le pop-up au premier chargement
window.addEventListener('load', function () {
    if (!localStorage.getItem('popupShown')) {
        loadIndexContent().then(() => {
            setTimeout(() => {
                showPopup();
                localStorage.setItem('popupShown', 'true');
            }, 500);
        });
    } else {
        console.log("Le pop-up a déjà été affiché pour cet utilisateur.");
    }
});