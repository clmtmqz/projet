
// Configuration et variables globales
const CONFIG = {
    SAINT_CHAMAS_COORDS: [43.5471, 5.0378],
    FRANCE_BOUNDS: [[41.333, -5.225], [51.124, 9.662]],
    ZOOM_THRESHOLDS: {
        DETAIL: 12,
        MEDIUM: 9,
        OVERVIEW: 6
    }
};

// Variables globales
let map;
let marinsData = null;
let buildingsData = null;
let markersLayer;
let rasterLayer;
let buildingsLayer;
let clusterPopup;
let currentZoom = 6;

// Chargement des données marins
function loadMarinsData() {
    fetch('data/marins_1764_WGS84.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du GeoJSON marins');
            }
            return response.json();
        })
        .then(data => {
            marinsData = data;
            displayMarkers();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des marins :', error);
        });
}

// Affichage des marqueurs selon le zoom
function displayMarkers() {
    if (!marinsData || !document.getElementById('markers-toggle').checked) return;
    
    markersLayer.clearLayers();
    
    const zoom = map.getZoom();
    
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL) {
        // Zoom détaillé : afficher tous les marqueurs individuels
        L.geoJSON(marinsData, {
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>${props.Prenom} ${props.Nom}</strong><br>
                    Domicile (1764) : ${props.Domicile_1764}<br>
                    Adresse précise : ${props.Domicile_precis_1764}
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(markersLayer);
    } else if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
        // Zoom moyen : créer des clusters
        createClusters();
    } else {
        // Zoom faible : clusters régionaux
        createRegionalClusters();
    }
}

function createClusters() {
    const clusters = new Map();
    const clusterSize = 0.05; // Taille du cluster en degrés
    
    marinsData.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const clusterKey = `${Math.floor(lat/clusterSize)}_${Math.floor(lng/clusterSize)}`;
        
        if (!clusters.has(clusterKey)) {
            clusters.set(clusterKey, {
                lat: Math.floor(lat/clusterSize) * clusterSize + clusterSize/2,
                lng: Math.floor(lng/clusterSize) * clusterSize + clusterSize/2,
                features: []
            });
        }
        
        clusters.get(clusterKey).features.push(feature);
    });
    
    clusters.forEach(cluster => {
        const count = cluster.features.length;
        const marker = L.marker([cluster.lat, cluster.lng], {
            icon: L.divIcon({
                html: `<div class="marker-cluster medium">${count}</div>`,
                iconSize: [40, 40],
                className: 'marker-cluster-container'
            })
        });
        
        marker.on('click', () => {
            showClusterPopup(cluster.features);
        });
        
        markersLayer.addLayer(marker);
    });
}

function createRegionalClusters() {
    // Créer des clusters très larges pour la vue d'ensemble
    const marker = L.marker([46.603354, 1.888334], {
        icon: L.divIcon({
            html: `<div class="marker-cluster large">${marinsData.features.length}</div>`,
            iconSize: [50, 50],
            className: 'marker-cluster-container'
        })
    });
    
    marker.on('click', () => {
        showClusterPopup(marinsData.features);
    });
    
    markersLayer.addLayer(marker);
}

// Chargement de la couche cadastre
function loadCadastreLayer() {
    if (!document.getElementById('raster-toggle').checked) return;
    
    rasterLayer.clearLayers();
    
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Afficher seulement si zoom élevé et dans la zone Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && bounds.contains(CONFIG.SAINT_CHAMAS_COORDS)) {
        
        // Option 1 : Essayer avec le TIF
        fetch('data/saint_chamas_cadastre_1819.tif')
            .then(response => {
                if (!response.ok) {
                    throw new Error('TIF non disponible');
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => parseGeoraster(arrayBuffer))
            .then(georaster => {
                const layer = new GeoRasterLayer({
                    georaster: georaster,
                    opacity: 0.7
                });
                rasterLayer.addLayer(layer);
            })
            .catch(error => {
                console.log('TIF non disponible, utilisation du JPEG');
                loadJpegCadastre();
            });
    }
}

// Option 2 : Chargement JPEG avec coordonnées
function loadJpegCadastre() {
    // Coordonnées approximatives pour Saint-Chamas
    const imageBounds = [
        [43.540, 5.030],  // Sud-Ouest
        [43.555, 5.045]   // Nord-Est
    ];
    
    const imageOverlay = L.imageOverlay('data/saint_chamas_cadastre_1819.jpeg', imageBounds, {
        opacity: 0.7,
        interactive: true
    });
    
    rasterLayer.addLayer(imageOverlay);
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadMarinsData();
    loadBuildingsData();
    updateZoomInfo();
});

// Initialisation de la carte
function initializeMap() {
    map = L.map('map').setView([46.603354, 1.888334], 6);
    
    // Couche de base OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Initialisation des couches
    markersLayer = L.layerGroup();
    rasterLayer = L.layerGroup();
    buildingsLayer = L.layerGroup();
    
    // Ajouter la couche des marqueurs par défaut
    markersLayer.addTo(map);
    
    // Événements de la carte
    map.on('zoomend', handleZoomChange);
    map.on('moveend', updateVisibleLayers);
    
    // Popup cluster
    clusterPopup = document.getElementById('cluster-popup');
}
// Chargement des données bâtiments
function loadBuildingsData() {
    fetch('data/building_chamas.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du GeoJSON bâtiments');
            }
            return response.json();
        })
        .then(data => {
            buildingsData = data;
            displayBuildings();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des bâtiments :', error);
        });
}

// Affichage des bâtiments
function displayBuildings() {
    if (!buildingsData || !document.getElementById('buildings-toggle').checked) return;
    
    buildingsLayer.clearLayers();
    
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Afficher seulement si zoom élevé et dans la zone Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && bounds.contains(CONFIG.SAINT_CHAMAS_COORDS)) {
        L.geoJSON(buildingsData, {
            style: {
                color: 'red',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.5
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>Bâtiment</strong><br>
                    ${props.name || props.type || 'Détails non disponibles'}
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(buildingsLayer);
    }
}
// Configuration des événements
function setupEventListeners() {
    // Contrôles des couches
    document.getElementById('markers-toggle').addEventListener('change', toggleMarkers);
    document.getElementById('raster-toggle').addEventListener('change', toggleRaster);
    document.getElementById('buildings-toggle').addEventListener('change', toggleBuildings);
    
    // Bouton Saint-Chamas
    document.getElementById('saint-chamas-btn').addEventListener('click', focusOnSaintChamas);
    
    // Fermeture du popup
    document.querySelector('.close-popup').addEventListener('click', closeClusterPopup);
    
    // Fermeture du popup en cliquant à l'extérieur
    clusterPopup.addEventListener('click', function(e) {
        if (e.target === clusterPopup) {
            closeClusterPopup();
        }
    });
}

// Chargement des données par défaut
function loadDefaultData() {
    loadMarkers();
    updateZoomInfo();
}

// Gestion des marqueurs
function loadMarkers() {
    markersLayer.clearLayers();
    
    const zoom = map.getZoom();
    
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL) {
        // Zoom détaillé : afficher tous les marqueurs individuels
        mockData.individuals.forEach(individual => {
            const marker = L.marker([individual.lat, individual.lng])
                .bindPopup(`
                    <strong>${individual.name}</strong><br>
                    Type: ${individual.type}<br>
                    ID: ${individual.id}
                `);
            markersLayer.addLayer(marker);
        });
    } else if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
        // Zoom moyen : grouper les marqueurs proches
        const clusters = clusterNearbyMarkers(mockData.individuals, 0.01);
        clusters.forEach(cluster => {
            const marker = L.marker([cluster.lat, cluster.lng], {
                icon: createClusterIcon(cluster.count)
            });
            
            marker.on('click', () => showClusterPopup(cluster));
            markersLayer.addLayer(marker);
        });
    } else {
        // Zoom global : grouper par région
        const regionalClusters = clusterByRegion(mockData.individuals);
        regionalClusters.forEach(cluster => {
            const marker = L.marker([cluster.lat, cluster.lng], {
                icon: createClusterIcon(cluster.count, 'large')
            });
            
            marker.on('click', () => showClusterPopup(cluster));
            markersLayer.addLayer(marker);
        });
    }
}

// Clustering des marqueurs proches
function clusterNearbyMarkers(individuals, threshold) {
    const clusters = [];
    const processed = new Set();
    
    individuals.forEach((individual, index) => {
        if (processed.has(index)) return;
        
        const cluster = {
            lat: individual.lat,
            lng: individual.lng,
            count: 1,
            individuals: [individual]
        };
        
        processed.add(index);
        
        // Trouver les individus proches
        individuals.forEach((other, otherIndex) => {
            if (processed.has(otherIndex)) return;
            
            const distance = Math.sqrt(
                Math.pow(individual.lat - other.lat, 2) + 
                Math.pow(individual.lng - other.lng, 2)
            );
            
            if (distance < threshold) {
                cluster.individuals.push(other);
                cluster.count++;
                processed.add(otherIndex);
            }
        });
        
        clusters.push(cluster);
    });
    
    return clusters;
}

// Clustering par région
function clusterByRegion(individuals) {
    const regions = {
        'Provence': { lat: 43.5, lng: 5.0, individuals: [] },
        'Île-de-France': { lat: 48.8, lng: 2.3, individuals: [] },
        'Rhône-Alpes': { lat: 45.7, lng: 4.8, individuals: [] },
        'Pays de la Loire': { lat: 47.2, lng: -1.5, individuals: [] },
        'Normandie': { lat: 49.4, lng: 0.1, individuals: [] }
    };
    
    individuals.forEach(individual => {
        // Logique simple pour assigner à une région
        let closestRegion = 'Provence';
        let minDistance = Infinity;
        
        Object.entries(regions).forEach(([name, region]) => {
            const distance = Math.sqrt(
                Math.pow(individual.lat - region.lat, 2) + 
                Math.pow(individual.lng - region.lng, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestRegion = name;
            }
        });
        
        regions[closestRegion].individuals.push(individual);
    });
    
    return Object.values(regions)
        .filter(region => region.individuals.length > 0)
        .map(region => ({
            lat: region.lat,
            lng: region.lng,
            count: region.individuals.length,
            individuals: region.individuals,
            isRegional: true
        }));
}

// Création d'icônes pour les clusters
function createClusterIcon(count, size = 'auto') {
    let iconSize, className;
    
    if (size === 'auto') {
        if (count < 5) {
            iconSize = [30, 30];
            className = 'marker-cluster small';
        } else if (count < 10) {
            iconSize = [40, 40];
            className = 'marker-cluster medium';
        } else {
            iconSize = [50, 50];
            className = 'marker-cluster large';
        }
    } else {
        iconSize = size === 'large' ? [50, 50] : [30, 30];
        className = `marker-cluster ${size}`;
    }
    
    return L.divIcon({
        html: `<div class="${className}">${count}</div>`,
        iconSize: iconSize,
        className: 'marker-cluster-container'
    });
}

// Affichage du popup de cluster
function showClusterPopup(cluster) {
    const detailsHtml = cluster.individuals.map(individual => `
        <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
            <strong>${individual.name}</strong><br>
            <small>Type: ${individual.type} | ID: ${individual.id}</small>
        </div>
    `).join('');
    
    document.getElementById('cluster-count').textContent = 
        `${cluster.count} entité${cluster.count > 1 ? 's' : ''} dans cette zone`;
    
    document.getElementById('cluster-details').innerHTML = detailsHtml;
    
    clusterPopup.classList.remove('hidden');
}

// Fermeture du popup
function closeClusterPopup() {
    clusterPopup.classList.add('hidden');
}

// Gestion du changement de zoom
function handleZoomChange() {
    const newZoom = map.getZoom();
    
    if (Math.abs(newZoom - currentZoom) >= 1) {
        currentZoom = newZoom;
        
        // Recharger les marqueurs selon le nouveau zoom
        if (document.getElementById('markers-toggle').checked) {
            loadMarkers();
        }
        
        // Gérer les couches selon le zoom
        updateLayerVisibility();
    }
    
    updateZoomInfo();
}

// Mise à jour de la visibilité des couches
function updateLayerVisibility() {
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Vérifier si on est sur Saint-Chamas
    const saintChamasVisible = bounds.contains(CONFIG.SAINT_CHAMAS_COORDS);
    
    // Raster et bâtiments seulement si zoom élevé et sur Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && saintChamasVisible) {
        if (document.getElementById('raster-toggle').checked) {
            loadRasterLayer();
        }
        if (document.getElementById('buildings-toggle').checked) {
            loadBuildingsLayer();
        }
    } else {
        // Supprimer les couches si zoom trop faible
        rasterLayer.clearLayers();
        buildingsLayer.clearLayers();
    }
}

// Chargement de la couche raster
function loadRasterLayer() {
    rasterLayer.clearLayers();
    
    // Exemple de couche raster pour Saint-Chamas
    const rasterBounds = [
        [43.540, 5.030],
        [43.555, 5.045]
    ];
    
    // Simulation d'une couche raster
    const rasterOverlay = L.rectangle(rasterBounds, {
        color: 'blue',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.3
    }).bindPopup('Couche raster - Zone d\'étude');
    
    rasterLayer.addLayer(rasterOverlay);
}

// Chargement de la couche bâtiments
function loadBuildingsLayer() {
    buildingsLayer.clearLayers();
    
    // Simulation de bâtiments pour Saint-Chamas
    const buildings = [
        { lat: 43.5471, lng: 5.0378, name: "Église" },
        { lat: 43.5475, lng: 5.0385, name: "Mairie" },
        { lat: 43.5465, lng: 5.0370, name: "Port" },
        { lat: 43.5480, lng: 5.0390, name: "Marché" }
    ];
    
    buildings.forEach(building => {
        const buildingPolygon = L.polygon([
            [building.lat - 0.0005, building.lng - 0.0005],
            [building.lat + 0.0005, building.lng - 0.0005],
            [building.lat + 0.0005, building.lng + 0.0005],
            [building.lat - 0.0005, building.lng + 0.0005]
        ], {
            color: 'red',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.5
        }).bindPopup(`Bâtiment: ${building.name}`);
        
        buildingsLayer.addLayer(buildingPolygon);
    });
}

// Basculement des couches
function toggleMarkers() {
    const isChecked = document.getElementById('markers-toggle').checked;
    
    if (isChecked) {
        map.addLayer(markersLayer);
        loadMarkers();
    } else {
        map.removeLayer(markersLayer);
    }
    
    updateZoomInfo();
}

function toggleRaster() {
    const isChecked = document.getElementById('raster-toggle').checked;
    
    if (isChecked) {
        map.addLayer(rasterLayer);
        updateLayerVisibility();
    } else {
        map.removeLayer(rasterLayer);
    }
    
    updateZoomInfo();
}

function toggleBuildings() {
    const isChecked = document.getElementById('buildings-toggle').checked;
    
    if (isChecked) {
        map.addLayer(buildingsLayer);
        updateLayerVisibility();
    } else {
        map.removeLayer(buildingsLayer);
    }
    
    updateZoomInfo();
}

// Focus sur Saint-Chamas
function focusOnSaintChamas() {
    map.setView(CONFIG.SAINT_CHAMAS_COORDS, CONFIG.ZOOM_THRESHOLDS.DETAIL);
    
    // Activer automatiquement les couches détaillées
    setTimeout(() => {
        document.getElementById('raster-toggle').checked = true;
        document.getElementById('buildings-toggle').checked = true;
        
        toggleRaster();
        toggleBuildings();
    }, 500);
}

// Mise à jour des informations de zoom
function updateZoomInfo() {
    document.getElementById('zoom-level').textContent = `Zoom: ${map.getZoom()}`;
    
    const activeLayers = [];
    if (map.hasLayer(markersLayer)) activeLayers.push('Marqueurs');
    if (map.hasLayer(rasterLayer)) activeLayers.push('Raster');
    if (map.hasLayer(buildingsLayer)) activeLayers.push('Bâtiments');
    
    document.getElementById('visible-layers').textContent = 
        `Couches: ${activeLayers.join(', ') || 'Aucune'}`;
}

// Mise à jour des couches visibles
function updateVisibleLayers() {
    updateLayerVisibility();
    updateZoomInfo();
}

// Gestion des erreurs
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Erreur JavaScript:', {
        message: msg,
        source: url,
        line: lineNo,
        column: columnNo,
        error: error
    });
    return false;
};

// Export pour usage externe si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        initializeMap,
        focusOnSaintChamas
    };
}