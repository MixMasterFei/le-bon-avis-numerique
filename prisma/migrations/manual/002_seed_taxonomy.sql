-- ============================================
-- Seed: Initial taxonomy data (Genres & Topics)
-- Run this after 001_quality_and_taxonomy.sql
-- ============================================

-- ============================================
-- GENRES (from TMDB)
-- ============================================

INSERT INTO genres (slug, name, name_fr, tmdb_id) VALUES
-- Movie genres
('action', 'Action', 'Action', 28),
('adventure', 'Adventure', 'Aventure', 12),
('animation', 'Animation', 'Animation', 16),
('comedy', 'Comedy', 'Comédie', 35),
('crime', 'Crime', 'Crime', 80),
('documentary', 'Documentary', 'Documentaire', 99),
('drama', 'Drama', 'Drame', 18),
('family', 'Family', 'Famille', 10751),
('fantasy', 'Fantasy', 'Fantastique', 14),
('history', 'History', 'Histoire', 36),
('horror', 'Horror', 'Horreur', 27),
('music', 'Music', 'Musique', 10402),
('mystery', 'Mystery', 'Mystère', 9648),
('romance', 'Romance', 'Romance', 10749),
('science-fiction', 'Science Fiction', 'Science-Fiction', 878),
('tv-movie', 'TV Movie', 'Téléfilm', 10770),
('thriller', 'Thriller', 'Thriller', 53),
('war', 'War', 'Guerre', 10752),
('western', 'Western', 'Western', 37)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TOPICS - Themes
-- ============================================

INSERT INTO topics (slug, name, name_fr, category, synonyms, icon) VALUES
-- THEME category
('aviation', 'Aviation', 'Aviation', 'THEME', ARRAY['avion', 'pilote', 'vol', 'aérien', 'aéroport', 'hélicoptère'], '✈️'),
('space', 'Space', 'Espace', 'THEME', ARRAY['astronaute', 'fusée', 'planète', 'étoile', 'galaxie', 'nasa'], '🚀'),
('magic', 'Magic', 'Magie', 'THEME', ARRAY['sorcier', 'sort', 'baguette', 'enchantement', 'mystique'], '✨'),
('nature', 'Nature', 'Nature', 'THEME', ARRAY['forêt', 'montagne', 'océan', 'animaux', 'environnement'], '🌿'),
('school', 'School', 'École', 'THEME', ARRAY['élève', 'professeur', 'classe', 'lycée', 'collège', 'université'], '🎓'),
('time-travel', 'Time Travel', 'Voyage dans le temps', 'THEME', ARRAY['passé', 'futur', 'temporel', 'machine'], '⏰'),
('pirates', 'Pirates', 'Pirates', 'THEME', ARRAY['bateau', 'trésor', 'mer', 'capitaine', 'île'], '🏴‍☠️'),
('medieval', 'Medieval', 'Médiéval', 'THEME', ARRAY['chevalier', 'château', 'roi', 'reine', 'épée', 'dragon'], '🏰'),

-- EMOTION category
('friendship', 'Friendship', 'Amitié', 'EMOTION', ARRAY['ami', 'copain', 'camarade', 'bande', 'groupe'], '🤝'),
('love', 'Love', 'Amour', 'EMOTION', ARRAY['romance', 'couple', 'coeur', 'sentiment'], '❤️'),
('courage', 'Courage', 'Courage', 'EMOTION', ARRAY['brave', 'héros', 'peur', 'surmonter'], '💪'),
('family-bonds', 'Family Bonds', 'Liens familiaux', 'EMOTION', ARRAY['parent', 'enfant', 'frère', 'soeur', 'famille'], '👨‍👩‍👧‍👦'),
('loss', 'Loss', 'Perte', 'EMOTION', ARRAY['deuil', 'mort', 'disparition', 'tristesse'], '😢'),
('growing-up', 'Growing Up', 'Grandir', 'EMOTION', ARRAY['adolescence', 'maturité', 'passage'], '🌱'),

-- ACTIVITY category
('sport', 'Sport', 'Sport', 'ACTIVITY', ARRAY['football', 'basketball', 'tennis', 'course', 'compétition'], '⚽'),
('music-activity', 'Music', 'Musique', 'ACTIVITY', ARRAY['chanter', 'instrument', 'concert', 'groupe', 'danse'], '🎵'),
('cooking', 'Cooking', 'Cuisine', 'ACTIVITY', ARRAY['recette', 'chef', 'restaurant', 'gastronomie'], '👨‍🍳'),
('art', 'Art', 'Art', 'ACTIVITY', ARRAY['peinture', 'dessin', 'sculpture', 'créatif'], '🎨'),
('gaming', 'Gaming', 'Jeux vidéo', 'ACTIVITY', ARRAY['gamer', 'console', 'virtuel'], '🎮'),

-- SETTING category
('city', 'City', 'Ville', 'SETTING', ARRAY['urbain', 'métropole', 'rue', 'building'], '🏙️'),
('countryside', 'Countryside', 'Campagne', 'SETTING', ARRAY['ferme', 'village', 'rural', 'champ'], '🌾'),
('underwater', 'Underwater', 'Sous-marin', 'SETTING', ARRAY['océan', 'mer', 'poisson', 'plongée'], '🐠'),
('jungle', 'Jungle', 'Jungle', 'SETTING', ARRAY['forêt tropicale', 'safari', 'amazonie'], '🌴'),
('desert', 'Desert', 'Désert', 'SETTING', ARRAY['sable', 'dune', 'oasis', 'sahara'], '🏜️'),

-- CHARACTER category
('dinosaurs', 'Dinosaurs', 'Dinosaures', 'CHARACTER', ARRAY['t-rex', 'jurassique', 'préhistorique', 'fossile'], '🦕'),
('robots', 'Robots', 'Robots', 'CHARACTER', ARRAY['androïde', 'machine', 'ia', 'mécanique'], '🤖'),
('princesses', 'Princesses', 'Princesses', 'CHARACTER', ARRAY['prince', 'royaume', 'couronne', 'conte'], '👸'),
('superheroes', 'Superheroes', 'Super-héros', 'CHARACTER', ARRAY['pouvoir', 'cape', 'masque', 'sauver'], '🦸'),
('animals', 'Animals', 'Animaux', 'CHARACTER', ARRAY['chien', 'chat', 'lion', 'ours', 'lapin'], '🐾'),
('monsters', 'Monsters', 'Monstres', 'CHARACTER', ARRAY['créature', 'effrayant', 'fantôme'], '👹'),
('witches-wizards', 'Witches & Wizards', 'Sorciers', 'CHARACTER', ARRAY['sorcière', 'magicien', 'sort', 'potion'], '🧙')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Done!
-- ============================================
