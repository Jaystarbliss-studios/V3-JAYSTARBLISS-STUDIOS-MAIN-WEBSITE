import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const defaultOrganisationProjects = [
  {
    id: 'org-stem-portal',
    title: 'Lagos STEM Education Portal',
    client: 'Ministry of Education Partnership',
    category: 'EdTech Platform',
    liveUrl: 'https://jaystarbliss.com',
    description: 'Comprehensive digital learning management platform designed for interactive STEM curriculum delivery, live code quizzes, and progress analytics across partner schools.',
    portfolioType: 'CLIENT_WORK',
    status: 'PUBLISHED',
    isFeatured: true,
    createdAt: new Date('2026-01-15').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'org-academy-tracker',
    title: 'Academy Student Assessment Suite',
    client: 'Jaystarbliss Learning Systems',
    category: 'Enterprise Web App',
    liveUrl: 'https://jaystarbliss.com',
    description: 'Custom full-stack tracking system empowering tutors and parents to monitor weekly coding milestones, badges, Scratch submissions, and real-time attendance.',
    portfolioType: 'CLIENT_WORK',
    status: 'PUBLISHED',
    isFeatured: true,
    createdAt: new Date('2026-02-01').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'org-robotics-curriculum',
    title: 'IoT & Robotics Workshop Toolkit',
    client: 'Lekki Tech Innovators Club',
    category: 'Hardware & IoT',
    liveUrl: 'https://jaystarbliss.com',
    description: 'Hands-on curriculum software integrating ESP32, Arduino microcontrollers, and drag-and-drop block coding modules for secondary school engineering bootcamps.',
    portfolioType: 'CLIENT_WORK',
    status: 'PUBLISHED',
    isFeatured: true,
    createdAt: new Date('2026-02-20').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultKidsProjectsList = [
  {
    id: 'scratch-funfinity',
    title: 'Funfinity Arena',
    creatorName: 'Daniel & Kamsi',
    creatorAge: 11,
    cohort: 'Summer Scratch Masters',
    description: 'A dynamic multiplayer arena game built with custom physics, sound effects, power-ups, and an interactive boss stage created entirely in Scratch.',
    embedUrl: 'https://scratch.mit.edu/projects/1237175440/embed',
    category: 'Scratch Game',
    status: 'PUBLISHED',
    featured: true,
    tags: ['Scratch', 'Arcade', 'Multiplayer', 'Cohort 2026'],
    plays: 420,
    likes: 68,
    createdAt: new Date('2026-02-10').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'scratch-space-odyssey',
    title: 'Space Rocket Odyssey',
    creatorName: 'Tobi A.',
    creatorAge: 10,
    cohort: 'Junior Game Devs',
    description: 'Navigate through dangerous asteroid belts and collect cosmic energy crystals to unlock rocket propulsion thrusters.',
    embedUrl: 'https://scratch.mit.edu/projects/1237175440/embed',
    category: 'Scratch Game',
    status: 'PUBLISHED',
    featured: false,
    tags: ['Space', 'Action', 'Beginner Scratch'],
    plays: 285,
    likes: 45,
    createdAt: new Date('2026-02-14').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'web-cyber-maze',
    title: 'Cyber Maze Escape 2026',
    creatorName: 'Michelle E.',
    creatorAge: 13,
    cohort: 'Web & Python Academy',
    description: 'A cyberpunk procedural maze game with timer mechanics, keycard inventory puzzles, and glowing particle portals.',
    embedUrl: 'https://scratch.mit.edu/projects/1237175440/embed',
    category: 'Web Game',
    status: 'PUBLISHED',
    featured: false,
    tags: ['Puzzle', 'Maze', 'Advanced'],
    plays: 350,
    likes: 54,
    createdAt: new Date('2026-02-18').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'scratch-robo-dodge',
    title: 'Robo Dodge Quest',
    creatorName: 'Emeka & Favour',
    creatorAge: 12,
    cohort: 'Robotics Club',
    description: 'Guide your autonomous bot across high-voltage obstacle grids while programming custom collision avoidance logic.',
    embedUrl: 'https://scratch.mit.edu/projects/1237175440/embed',
    category: 'Scratch Game',
    status: 'PUBLISHED',
    featured: false,
    tags: ['Robotics', 'Logic', 'Scratch'],
    plays: 195,
    likes: 38,
    createdAt: new Date('2026-02-25').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultBlogPosts = [
  {
    id: 'why-every-child-should-learn-to-code',
    title: 'Why Every Child in Nigeria Should Learn to Code Early',
    slug: 'why-every-child-should-learn-to-code',
    author: 'John Rufai',
    category: 'coding',
    excerpt: 'Exploring how computational thinking, Scratch, and early algorithmic problem solving prepare young learners for the next century of innovation.',
    content: '<p>In a world increasingly driven by digital infrastructure, programming has evolved from a niche specialty into an essential foundational literacy. Teaching children how to code at a young age instills logical reasoning, systemic problem-solving, and creative confidence.</p><h2>Building Builders, Not Just Consumers</h2><p>At Jaystarbliss Studios, our mission is to transform students from passive digital consumers into passionate creators and engineers who construct their own games, websites, and intelligent systems.</p>',
    status: 'PUBLISHED',
    createdAt: new Date('2026-01-20').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'robotics-esp32-arduino-starter-guide',
    title: 'Getting Started with Robotics & Microcontrollers: ESP32 & Arduino Guide',
    slug: 'robotics-esp32-arduino-starter-guide',
    author: 'Jaystarbliss Engineering',
    category: 'robotics',
    excerpt: 'A step-by-step breakdown for educators and enthusiastic students diving into hands-on circuit wiring, sensor inputs, and embedded C++.',
    content: '<p>Robotics bridges the digital realm of code with the tangible physical world of circuits, motors, and sensors. Through hands-on experimentation with ESP32 and Arduino boards, students grasp real-world physics, electronics, and automation.</p>',
    status: 'PUBLISHED',
    createdAt: new Date('2026-02-12').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultNewsBulletins = [
  {
    id: 'national-coding-olympiad-winners',
    title: 'Jaystarbliss Students Triumphant at National Coding Olympiad 2026',
    slug: 'national-coding-olympiad-winners',
    category: 'achievement',
    views: 142,
    excerpt: 'Our young prodigies brought home top honors in Scratch game design, AI prompts, and physical robotics showcases.',
    content: '<p>We are immensely proud to announce that students from the Jaystarbliss Junior Tech Cohorts achieved top placements in the 2026 National STEM and Coding Challenge! Their innovative interactive games and automated robotics presentations captivated the judges.</p>',
    status: 'PUBLISHED',
    createdAt: new Date('2026-02-28').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cohort-admissions-open-2026',
    title: 'Admissions Now Open for Next-Gen Tech & Academic Cohorts',
    slug: 'cohort-admissions-open-2026',
    category: 'announcement',
    views: 88,
    excerpt: 'Registration is officially live for physical weekend workshops, private tutoring, and online coding masterclasses.',
    content: '<p>Enrollment is now officially open for our upcoming session. Secure your child’s spot in our specialized tracks spanning foundational academics, Scratch game development, web engineering, and robotics.</p>',
    status: 'PUBLISHED',
    createdAt: new Date('2026-03-01').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'grand-launch-magic-particles-lab',
    title: 'Grand Launch of the 3D Gesture & Magic Particles Lab',
    slug: 'grand-launch-magic-particles-lab',
    category: 'news',
    views: 320,
    excerpt: 'Experience physics-defying 3D particle simulations directly in your web browser with camera and touch gestures.',
    content: '<p>Jaystarbliss is thrilled to unveil the new interactive 3D Magic Particles playground! Built using Three.js and real-time mathematical assembly algorithms, visitors can manipulate thousands of radiant particles effortlessly.</p>',
    status: 'PUBLISHED',
    createdAt: new Date('2026-03-05').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * Ensures Firestore has the default documents if empty,
 * enabling immediate CRUD editing and deletion from the Admin CMS.
 */
export async function autoSeedCollectionsIfEmpty(): Promise<void> {
  try {
    // 1. Seed portfolio
    const portSnap = await getDocs(collection(db, 'portfolio'));
    if (portSnap.empty) {
      for (const item of defaultOrganisationProjects) {
        await setDoc(doc(db, 'portfolio', item.id), item);
      }
    }

    // 2. Seed kidsProjects
    const kidsSnap = await getDocs(collection(db, 'kidsProjects'));
    if (kidsSnap.empty) {
      for (const item of defaultKidsProjectsList) {
        await setDoc(doc(db, 'kidsProjects', item.id), item);
      }
    }

    // 3. Seed blog
    const blogSnap = await getDocs(collection(db, 'blog'));
    if (blogSnap.empty) {
      for (const item of defaultBlogPosts) {
        await setDoc(doc(db, 'blog', item.id), item);
      }
    }

    // 4. Seed newsCorner
    const newsSnap = await getDocs(collection(db, 'newsCorner'));
    if (newsSnap.empty) {
      for (const item of defaultNewsBulletins) {
        await setDoc(doc(db, 'newsCorner', item.id), item);
      }
    }
  } catch (err) {
    // Non-blocking catch so offline/read-only mode doesn't break
    console.warn('Firestore seeding check:', err);
  }
}
