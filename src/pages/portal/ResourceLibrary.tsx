import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, Download, FileText, Bookmark, 
  Sparkles, Eye, CheckCircle2, Copy, Printer, 
  Layers, GraduationCap, X, FileCode, Terminal, Loader2,
  Clock, Flame, Zap
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

export interface ResourceDocument {
  id: string;
  title: string;
  category: 'student' | 'school' | 'both' | 'staff' | 'all';
  subject: string;
  classLevel: string;
  docType: 'PDF' | 'Lesson Note' | 'Syllabus' | 'Lab Worksheet' | 'Cheatsheet' | 'Past Exam';
  description: string;
  fileUrl?: string;
  fileSize?: string;
  downloadCount?: number;
  term?: string;
  author?: string;
  content?: {
    overview: string;
    learningObjectives: string[];
    keyConcepts: { heading: string; detail: string; codeSnippet?: string }[];
    practiceExercises: string[];
    furtherReading?: string;
  };
  tags?: string[];
  dateAdded?: string;
  isFeatured?: boolean;
}

// 48-Hour Recency Helper Functions
export const getRecentDate = (hoursAgo: number = 0): string => {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
};

export const isResourceRecent = (dateAdded?: string): boolean => {
  if (!dateAdded) return false;
  try {
    const time = new Date(dateAdded).getTime();
    if (isNaN(time)) return false;
    const diffMs = Date.now() - time;
    // Within 48 hours (48 * 3600 * 1000 ms) and not future dated beyond 5 mins
    return diffMs >= -300000 && diffMs <= 48 * 3600 * 1000;
  } catch {
    return false;
  }
};

export const getRecentTimeLabel = (dateAdded?: string): string => {
  if (!dateAdded) return 'Recent';
  try {
    const time = new Date(dateAdded).getTime();
    if (isNaN(time)) return 'Recent';
    const diffMs = Date.now() - time;
    const hours = Math.floor(diffMs / (3600 * 1000));
    if (hours <= 0) return 'Just now';
    if (hours === 1) return '1h ago';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Recent';
  }
};

export const CURATED_RESOURCE_LIBRARY: ResourceDocument[] = [
  {
    id: 'res-syl-01',
    title: 'Junior Secondary STEM & Python Track Syllabus (Terms 1 - 3)',
    category: 'both',
    subject: 'Python, Data Science & AI',
    classLevel: 'STEM Explorers (Ages 10-13 / JSS 1-3)',
    docType: 'Syllabus',
    description: 'Complete 36-week progressive syllabus covering algorithmic logic, variables, loops, Pygame zero, and introductory machine learning concepts.',
    fileSize: '2.4 MB PDF',
    term: 'Full Academic Year',
    author: 'Jaystarbliss Academic Board',
    isFeatured: true,
    tags: ['Python', 'Curriculum', 'JSS', 'Algorithms'],
    dateAdded: getRecentDate(4), // 4 hours ago (Recent 48h)
    content: {
      overview: 'This comprehensive syllabus establishes the foundation of computational thinking and textual programming for students transitioning from visual blocks to Python. Structured in 3 iterative terms with milestone projects.',
      learningObjectives: [
        'Understand Python syntax, datatypes, variables, and mathematical operators',
        'Master control flow using conditional branching (if/elif/else) and loop iteration (for/while)',
        'Build interactive terminal applications, number guessing games, and text-based adventures',
        'Learn object-oriented basics and 2D canvas drawing with Pygame Zero',
        'Develop problem-solving resilience, code debugging, and algorithmic decomposition'
      ],
      keyConcepts: [
        {
          heading: 'Term 1: Logic Architecture & Syntax',
          detail: 'Students write clean Python code using standard PEP 8 naming conventions. They learn memory allocation via variables and interactive I/O handling with formatted print statements.',
          codeSnippet: '# Interactive Greeting & Age Calculator\nname = input("Enter Cadet Name: ")\nage = int(input("Enter Current Age: "))\nyears_to_18 = 18 - age\nprint(f"Welcome Cadet {name}! You have {years_to_18} years until senior engineering.")'
        },
        {
          heading: 'Term 2: Data Structures & Iteration',
          detail: 'Diving into collections: Lists, Tuples, and Dictionaries. Students learn list indexing, slicing, appending, and iterating through datasets with list comprehensions.'
        },
        {
          heading: 'Term 3: Visual Game Engineering & Mini AI',
          detail: 'Building real-time animation loops, collision detection, sprite physics, and simple decision-tree chatbots using Python.'
        }
      ],
      practiceExercises: [
        'Exercise 1.1: Build an automated currency & temperature converter',
        'Exercise 1.2: Design a multi-level Math Quiz game with score tracking',
        'Exercise 2.1: Implement a School Library Inventory Manager with dictionaries',
        'Exercise 3.1: Final Capstone: 2D Arcade Dodger with high-score local saving'
      ],
      furtherReading: 'Official Python.org Documentation & Jaystarbliss Cadet Starter Portal'
    }
  },
  {
    id: 'res-note-01',
    title: 'Lesson Note: Introduction to Microcontrollers, GPIO & Arduino Circuits',
    category: 'both',
    subject: 'Robotics & Hardware',
    classLevel: 'Senior Code Masters (Ages 14-18)',
    docType: 'Lesson Note',
    description: 'Detailed modular notes on breadboard wiring, digital vs analog pins, Ohm’s Law calculations, and writing C++ sketches for sensor telemetry.',
    fileSize: '3.8 MB PDF',
    term: 'Term 1 Week 3',
    author: 'Engr. J. Rufai & Hardware Dept',
    isFeatured: true,
    tags: ['Robotics', 'Arduino', 'Sensors', 'Electronics'],
    dateAdded: getRecentDate(16), // 16 hours ago (Recent 48h)
    content: {
      overview: 'A foundational engineering module teaching cadets how software communicates with physical hardware components through voltage levels, pulse-width modulation (PWM), and digital signal processing.',
      learningObjectives: [
        'Identify breadboard bus rails, terminal strips, and resistor color-code calculations',
        'Distinguish between Digital Input/Output (HIGH/LOW 5V) and Analog Inputs (ADC 0-1023)',
        'Calculate current limits using Ohm’s Law (V = I * R) to protect LEDs and microcontrollers',
        'Program Arduino IDE sketches utilizing setup(), loop(), pinMode(), digitalWrite(), and analogRead()'
      ],
      keyConcepts: [
        {
          heading: '1. Ohm’s Law & LED Current Limiting',
          detail: 'A typical standard LED has a forward voltage drop of ~2.0V and maximum forward current of 20mA (0.02A). When connected to a 5V pin, the required resistor is R = (5.0V - 2.0V) / 0.02A = 150 Ohms. We typically use a safe 220 Ohm or 330 Ohm resistor.',
          codeSnippet: '// Arduino C++ Blink with Serial Telemetry\nconst int LED_PIN = 13;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(9600);\n  Serial.println("System Initialized: Smart Lab Node Ready");\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("LED Status: ON");\n  delay(1000);\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("LED Status: OFF");\n  delay(1000);\n}'
        },
        {
          heading: '2. Analog Sensing with Ultrasonic HC-SR04',
          detail: 'Measuring distance using high-frequency sonic bursts. The Trigger pin emits a 10-microsecond ultrasonic pulse, and the Echo pin calculates return duration: Distance (cm) = (Duration * 0.0343) / 2.'
        }
      ],
      practiceExercises: [
        'Lab Task 1: Wire an RGB LED and cycle through Primary Red, Green, and Blue states.',
        'Lab Task 2: Build an automatic smart security alarm that sounds a buzzer when an object is within 15cm.',
        'Lab Task 3: Read an LDR (Light Dependent Resistor) and print ambient lumen values to Serial Monitor.'
      ]
    }
  },
  {
    id: 'res-syl-02',
    title: 'School Lab Institutional Scheme of Work & Assessment Rubrics',
    category: 'school',
    subject: 'Institutional Lab Framework',
    classLevel: 'Partner School Labs (All Batches)',
    docType: 'Syllabus',
    description: 'Structured 12-week termly guide for ICT coordinators, teacher weekly lesson plans, hardware kit safety protocols, and student grading sheets.',
    fileSize: '4.1 MB PDF',
    term: 'Term 1 / Term 2 Scheme',
    author: 'Jaystarbliss School Operations',
    isFeatured: true,
    tags: ['Institutional', 'Rubrics', 'Lesson Plans', 'Teachers'],
    dateAdded: getRecentDate(30), // 30 hours ago (Recent 48h)
    content: {
      overview: 'This institutional package equips partner school educators and ICT directors with week-by-week lesson notes, projector slide guides, hands-on lab worksheets, and continuous assessment grading rubrics.',
      learningObjectives: [
        'Deliver weekly standardized 60-minute practical coding sessions',
        'Maintain hardware kit inventory (mBot, Arduino Uno, BBC micro:bit) with zero part degradation',
        'Track student attendance, practical skill acquisition, and capstone demo quality',
        'Administer mid-term CBT practical benchmarks and end-of-term tech exhibitions'
      ],
      keyConcepts: [
        {
          heading: 'Standard Lab Session Protocol (60 Mins)',
          detail: '• 00-10m: Concept Introduction & Visual Demo via Projector\n• 10-40m: Pair-Programming Lab Challenge & Live Code Execution\n• 40-50m: Peer Code Review & Bug Squashing\n• 50-60m: Clean-up, Git/Workspace Sync & Next Week Teaser'
        },
        {
          heading: 'Assessment Matrix (100% Total)',
          detail: '• 20% Weekly Class Worksheets & Attendance\n• 30% Mid-Term Practical Coding Benchmark\n• 50% End-of-Term Project Exhibition (Logic, UI Design, Presentation)'
        }
      ],
      practiceExercises: [
        'School Admin Task 1: Print & distribute Student Access Code roster',
        'School Admin Task 2: Review weekly tutor inspection log in the School Portal'
      ]
    }
  },
  {
    id: 'res-ws-01',
    title: 'Web Engineering Lab Worksheet: HTML5 Semantic Layouts & CSS Flexbox',
    category: 'both',
    subject: 'Web Engineering (HTML/CSS/JS)',
    classLevel: 'Senior Code Masters (Ages 14-18)',
    docType: 'Lab Worksheet',
    description: 'Step-by-step practical challenge to code a responsive responsive landing page using semantic HTML tags and modern CSS Flexbox grids.',
    fileSize: '1.9 MB PDF',
    term: 'Term 1 Week 5',
    author: 'Frontend Lab Faculty',
    tags: ['Web', 'HTML5', 'CSS3', 'Flexbox', 'Responsive'],
    dateAdded: '2026-07-28',
    content: {
      overview: 'Modern web development starts with semantic HTML and robust CSS layout models. In this practical challenge, students construct an accessible, mobile-first product page.',
      learningObjectives: [
        'Implement semantic elements (<header>, <nav>, <main>, <section>, <article>, <footer>)',
        'Master CSS Flexbox properties: display: flex, justify-content, align-items, flex-wrap',
        'Apply media queries (@media screen and (max-width: 768px)) for mobile responsiveness',
        'Organize stylesheet architecture with custom CSS variables and color palettes'
      ],
      keyConcepts: [
        {
          heading: 'Flexbox Quick Rulebook',
          detail: 'Main axis is controlled via justify-content (center, space-between, space-around). Cross axis is controlled via align-items (center, flex-start, stretch).',
          codeSnippet: '/* Responsive Flexbox Container */\n.card-grid {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: stretch;\n  gap: 1.5rem;\n  flex-wrap: wrap;\n}\n\n@media (max-width: 768px) {\n  .card-grid {\n    flex-direction: column;\n  }\n}'
        }
      ],
      practiceExercises: [
        'Step 1: Create index.html and style.css in your VS Code workspace',
        'Step 2: Code a 3-card Pricing Tier component using Flexbox',
        'Step 3: Test responsiveness using Chrome DevTools Device Mode'
      ]
    }
  },
  {
    id: 'res-cheat-01',
    title: 'Junior Scratch 3.0 Game Blocks & Event Listeners Cheatsheet',
    category: 'student',
    subject: 'Scratch 3.0 & Game Dev',
    classLevel: 'Elementary (Ages 6-9 / Primary 1-4)',
    docType: 'Cheatsheet',
    description: 'High-density visual quick reference sheet covering motion coordinates, costume loops, broadcast messaging, and score variables in Scratch.',
    fileSize: '1.2 MB PDF',
    term: 'Primary Grade Pack',
    author: 'Kids Zone Lab Mentors',
    tags: ['Scratch', 'Kids', 'Game Design', 'Cheatsheet'],
    dateAdded: '2026-07-20',
    content: {
      overview: 'A colorful visual guide for young coders learning coordinate geometry (X and Y axes), broadcast event messaging, and sprite animations in MIT Scratch 3.0.',
      learningObjectives: [
        'Understand (X: 0, Y: 0) as canvas center and -240 to +240 width range',
        'Use "when green flag clicked" and "when key space pressed" event triggers',
        'Loop animations with "next costume" and "wait 0.1 secs"',
        'Create variables like "Cadet Score" and "Lives Remaining"'
      ],
      keyConcepts: [
        {
          heading: 'Coordinate Map of Scratch Canvas',
          detail: '• Center: (0, 0)\n• Top Right: (240, 180)\n• Bottom Left: (-240, -180)\n• Moving Right: change x by 10\n• Jumping Up: change y by 10'
        },
        {
          heading: 'Broadcast Messaging Trick',
          detail: 'Use "broadcast [Game Over]" in your main enemy sprite, then in your GameOver Screen sprite, use "when I receive [Game Over] -> show".'
        }
      ],
      practiceExercises: [
        'Mini-Task: Make a Cat Sprite jump smoothly with a custom gravity script.',
        'Mini-Task: Create an Apple collecting game with sound effects.'
      ]
    }
  },
  {
    id: 'res-exam-01',
    title: 'Digital Literacy & Computer Science CBT Mock Exam (60 Questions + Solutions)',
    category: 'both',
    subject: 'Computer Science & CBT Exam Prep',
    classLevel: 'STEM Explorers (Ages 10-13 / JSS 1-3)',
    docType: 'Past Exam',
    description: '60 comprehensive multiple-choice questions covering binary arithmetic, network topologies, cyber safety, algorithmic pseudocode, and answer explanations.',
    fileSize: '2.8 MB PDF',
    term: 'Mock Exam Term 2',
    author: 'CBT Examination Committee',
    tags: ['CBT', 'Exam', 'Computer Science', 'Revision', 'Questions'],
    dateAdded: '2026-07-15',
    content: {
      overview: 'Standardized examination revision booklet designed to prepare students for school termly ICT assessments, BECE / Junior WAEC computer studies, and digital literacy certifications.',
      learningObjectives: [
        'Test proficiency in computer hardware, CPU cycle (Fetch-Decode-Execute), and storage units',
        'Evaluate understanding of internet security, phishing defense, and strong passwords',
        'Solve binary to decimal conversions and truth table boolean logic (AND, OR, NOT)',
        'Interpret flowcharts and trace variable values in pseudocode dry-runs'
      ],
      keyConcepts: [
        {
          heading: 'Sample Question 1: Binary Conversion',
          detail: 'Convert Binary 1011_2 to Base 10:\n• (1 * 2^3) + (0 * 2^2) + (1 * 2^1) + (1 * 2^0)\n• 8 + 0 + 2 + 1 = 11 in Base 10.\nCorrect Answer: 11'
        },
        {
          heading: 'Sample Question 2: Algorithmic Logic',
          detail: 'Given: x = 5; while (x < 15): x = x + 3;\nTracing: x starts at 5 -> 8 -> 11 -> 14 -> 17.\nLoop terminates when x is 17. Total iterations: 4 times.'
        }
      ],
      practiceExercises: [
        'Complete Part A: 40 Objective Questions (Time Allowed: 45 Mins)',
        'Complete Part B: 4 Practical Scenario Questions (Time Allowed: 30 Mins)'
      ]
    }
  },
  {
    id: 'res-note-02',
    title: 'Lesson Note: Cyber Safety, Strong Cryptography & Cloud Computing',
    category: 'both',
    subject: 'Cybersecurity & Digital Literacy',
    classLevel: 'Senior Code Masters (Ages 14-18)',
    docType: 'Lesson Note',
    description: 'Comprehensive study notes on modern cyber hygiene, public-key cryptography, HTTPS protocols, two-factor authentication, and safe digital citizenship.',
    fileSize: '3.1 MB PDF',
    term: 'Term 2 Week 4',
    author: 'Cybersecurity Operations Unit',
    tags: ['Security', 'Cloud', 'Cryptography', 'Privacy'],
    dateAdded: '2026-07-02',
    content: {
      overview: 'An essential masterclass on safeguarding digital identities, understanding encryption algorithms (AES, RSA), preventing social engineering attacks, and using cloud platforms securely.',
      learningObjectives: [
        'Understand symmetric vs asymmetric encryption architectures',
        'Identify social engineering attack vectors: Phishing, Spear-phishing, Pretexting',
        'Configure multi-factor authentication (MFA/TOTP) and password manager vaults',
        'Evaluate cloud computing models: IaaS, PaaS, SaaS'
      ],
      keyConcepts: [
        {
          heading: 'Public-Key (Asymmetric) Encryption',
          detail: 'Uses a mathematically linked keypair: A Public Key for encryption (shareable with the world) and a Private Key for decryption (kept strictly confidential on the secure hardware enclave).'
        }
      ],
      practiceExercises: [
        'Lab Activity: Generate an SSH Keypair on terminal using ssh-keygen -t ed25519',
        'Lab Activity: Analyze a suspicious email header to detect spoofed sender domains'
      ]
    }
  }
];

interface ResourceLibraryProps {
  role?: 'student' | 'school' | 'staff' | 'parent' | 'all';
}

const CLASS_LEVELS = [
  'All Classes',
  'Elementary (Ages 6-9 / Primary 1-4)',
  'STEM Explorers (Ages 10-13 / JSS 1-3)',
  'Senior Code Masters (Ages 14-18)',
  'Partner School Labs (All Batches)'
];

const SUBJECTS = [
  'All Subjects',
  'Python, Data Science & AI',
  'Robotics & Hardware',
  'Web Engineering (HTML/CSS/JS)',
  'Scratch 3.0 & Game Dev',
  'Computer Science & CBT Exam Prep',
  'Cybersecurity & Digital Literacy',
  'Institutional Lab Framework'
];

const DOC_TYPES = [
  'All Types',
  'Syllabus',
  'Lesson Note',
  'Lab Worksheet',
  'Cheatsheet',
  'Past Exam',
  'PDF'
];

export const ResourceLibrary: React.FC<ResourceLibraryProps> = ({ role = 'all' }) => {
  const { toast } = useToast();
  const [resources, setResources] = useState<ResourceDocument[]>(CURATED_RESOURCE_LIBRARY);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedDocType, setSelectedDocType] = useState('All Types');
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'saved' | 'syllabi' | 'notes' | 'worksheets'>('all');
  const [sortBy, setSortBy] = useState<'auto' | 'newest' | 'popular' | 'title-asc'>('auto');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jaystarbliss_bookmarked_resources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active Document Reader Modal
  const [previewDoc, setPreviewDoc] = useState<ResourceDocument | null>(null);

  // Compute number of items uploaded in the last 48 hours for current role
  const recentCount = useMemo(() => {
    return resources.filter(item => {
      if (role === 'student' && item.category === 'school') return false;
      if (role === 'school' && item.category === 'student') return false;
      return isResourceRecent(item.dateAdded);
    }).length;
  }, [resources, role]);

  // Fetch Firestore resources merged with curated library
  useEffect(() => {
    const fetchFirestoreResources = async () => {
      try {
        setLoading(true);
        const snap = await getDocs(query(collection(db, 'resources'), orderBy('timestamp', 'desc'))).catch(() => 
          getDocs(collection(db, 'resources'))
        );
        
        if (!snap.empty) {
          const dbItems: ResourceDocument[] = snap.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              title: d.title || 'Curriculum Material',
              category: d.category || 'both',
              subject: d.subject || 'Computer Science & ICT',
              classLevel: d.classLevel || 'STEM Explorers (Ages 10-13 / JSS 1-3)',
              docType: (d.type as any) || (d.docType as any) || 'PDF',
              description: d.description || 'Educational reference handout and study guide.',
              fileUrl: d.fileUrl || d.url || '',
              fileSize: d.fileSize || 'PDF Document',
              author: d.author || 'Jaystarbliss Tutors',
              dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.dateAdded || getRecentDate(2),
              tags: d.tags || ['Study Material']
            };
          });

          // Deduplicate and merge
          const existingIds = new Set(CURATED_RESOURCE_LIBRARY.map(r => r.id));
          const newUnique = dbItems.filter(item => !existingIds.has(item.id));
          setResources([...newUnique, ...CURATED_RESOURCE_LIBRARY]);
        }
      } catch (err) {
        console.warn('Could not fetch external resources, using curated bank:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirestoreResources();
  }, []);

  // Handle bookmark toggle
  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds(prev => {
      const updated = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem('jaystarbliss_bookmarked_resources', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save bookmarks:', err);
      }
      toast.success(prev.includes(id) ? 'Removed from saved bookmarks' : 'Added to saved bookmarks!');
      return updated;
    });
  };

  // Handle file download
  const handleDownload = (doc: ResourceDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toast.info(`Preparing download for "${doc.title}"...`);

    // If external fileUrl exists, trigger direct window download
    if (doc.fileUrl && (doc.fileUrl.startsWith('http') || doc.fileUrl.startsWith('/'))) {
      const link = document.createElement('a');
      link.href = doc.fileUrl;
      link.target = '_blank';
      link.download = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded "${doc.title}"!`);
      return;
    }

    // Generate formatted text/markdown download blob if static structured content
    if (doc.content) {
      const contentText = `
===================================================================
JAYSTARBLISS STUDIOS ACADEMY | OFFICIAL CURRICULUM RESOURCE
===================================================================
Document: ${doc.title}
Subject: ${doc.subject}
Class Level: ${doc.classLevel}
Document Type: ${doc.docType}
Author / Faculty: ${doc.author || 'Academic Board'}
Date Published: ${doc.dateAdded || '2026 Academic Term'}
-------------------------------------------------------------------

1. OVERVIEW & SCOPE
${doc.content.overview}

2. LEARNING OBJECTIVES
${doc.content.learningObjectives.map((obj, i) => `[${i + 1}] ${obj}`).join('\n')}

3. CORE CONCEPTS & LESSON NOTES
${doc.content.keyConcepts.map(c => `\n### ${c.heading}\n${c.detail}\n${c.codeSnippet ? `\n[CODE SNIPPET / SYNTAX]:\n${c.codeSnippet}\n` : ''}`).join('\n')}

4. HANDS-ON PRACTICE TASKS & LAB EXERCISES
${doc.content.practiceExercises.map((ex, i) => `(Task ${i + 1}) ${ex}`).join('\n')}

${doc.content.furtherReading ? `\n5. RECOMMENDED NEXT STEPS\n${doc.content.furtherReading}\n` : ''}
===================================================================
(c) Jaystarbliss Studios. Learn. Build. Create. Grow.
https://jaystarbliss-studios.name.ng
===================================================================
`.trim();

      const blob = new Blob([contentText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded "${doc.title}" study material!`);
    } else {
      toast.success(`Access link opened for "${doc.title}".`);
    }
  };

  // Filtered and automatically sorted resources calculation
  const filteredResources = useMemo(() => {
    const list = resources.filter(item => {
      // Role match
      if (role === 'student' && item.category === 'school') return false;
      if (role === 'school' && item.category === 'student') return false;

      // Tab filter
      if (activeTab === 'recent') {
        if (!isResourceRecent(item.dateAdded)) return false;
      } else if (activeTab === 'saved') {
        if (!bookmarkedIds.includes(item.id)) return false;
      } else if (activeTab === 'syllabi') {
        if (item.docType !== 'Syllabus') return false;
      } else if (activeTab === 'notes') {
        if (item.docType !== 'Lesson Note') return false;
      } else if (activeTab === 'worksheets') {
        if (item.docType !== 'Lab Worksheet' && item.docType !== 'Cheatsheet' && item.docType !== 'Past Exam') return false;
      }

      // Class Filter
      if (selectedClass !== 'All Classes' && !item.classLevel.toLowerCase().includes(selectedClass.toLowerCase().slice(0, 8))) {
        return false;
      }

      // Subject Filter
      if (selectedSubject !== 'All Subjects' && item.subject !== selectedSubject) {
        return false;
      }

      // Doc Type Filter
      if (selectedDocType !== 'All Types' && item.docType !== selectedDocType) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = item.description.toLowerCase().includes(query);
        const subjectMatch = item.subject.toLowerCase().includes(query);
        const tagMatch = item.tags?.some(t => t.toLowerCase().includes(query));
        if (!titleMatch && !descMatch && !subjectMatch && !tagMatch) return false;
      }

      return true;
    });

    // Automatic Sorting with 48h recency prioritization
    return list.sort((a, b) => {
      if (sortBy === 'auto') {
        const aRecent = isResourceRecent(a.dateAdded);
        const bRecent = isResourceRecent(b.dateAdded);
        // Automatic: Categorize materials uploaded within 48h to the top
        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;

        // Within same recency category, sort newest first
        const timeA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const timeB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'newest') {
        const timeA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const timeB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'popular') {
        const popA = (a.isFeatured ? 50 : 10) + (bookmarkedIds.includes(a.id) ? 25 : 0);
        const popB = (b.isFeatured ? 50 : 10) + (bookmarkedIds.includes(b.id) ? 25 : 0);
        return popB - popA;
      } else if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [resources, role, activeTab, selectedClass, selectedSubject, selectedDocType, searchQuery, bookmarkedIds, sortBy]);

  const copyDocLink = (docItem: ResourceDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/portal/${role}/resources?doc=${docItem.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Resource link copied to clipboard!');
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'Syllabus':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Lesson Note':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Lab Worksheet':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Cheatsheet':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Past Exam':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SEO 
        title="Resource Library & Syllabi Hub | Jaystarbliss Studios" 
        description="Search, view and download lesson notes, curriculum syllabi, and coding worksheets for students and school educators."
        noindex={true}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-slate via-slate-900 to-brand-slate text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/20 text-brand-red text-xs font-bold uppercase tracking-wider mb-3 border border-brand-red/30">
              <Sparkles size={13} />
              <span>Academic Resource Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Curriculum & Resource Library
            </h1>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              Explore termly lesson notes, project lab worksheets, coding cheatsheets, and institutional syllabi categorized by class level and technology track.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10 shrink-0">
            <div className="text-center px-3 py-1">
              <p className="text-xl font-black text-white flex items-center justify-center gap-1">
                {resources.length}
                {loading && <Loader2 size={12} className="animate-spin text-gray-400 inline" />}
              </p>
              <p className="text-[11px] text-gray-400 font-medium">Resources</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center px-3 py-1">
              <p className="text-xl font-black text-brand-red">100%</p>
              <p className="text-[11px] text-gray-400 font-medium">Verified STEM</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center px-3 py-1">
              <p className="text-xl font-black text-emerald-400">{bookmarkedIds.length}</p>
              <p className="text-[11px] text-gray-400 font-medium">Saved</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources by topic (e.g. Python loops, Arduino GPIO, Flexbox, Scratch, CBT Mock Exam)..."
            className="w-full pl-11 pr-10 py-3.5 bg-white/10 focus:bg-white/15 dark:bg-slate-800/80 border border-white/20 focus:border-brand-red rounded-2xl text-white placeholder-gray-400 text-sm outline-hidden transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav Tabs & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            id="tab-all-resources"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-brand-slate text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-brand-red'
            }`}
          >
            <Layers size={14} />
            <span>All Materials</span>
            <span className="px-1.5 py-0.2 bg-black/20 rounded-full text-[10px]">
              {resources.length}
            </span>
          </button>

          {/* Recent (48h) Tab */}
          <button
            id="tab-recent-resources"
            onClick={() => setActiveTab('recent')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'recent'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-amber-500'
            }`}
          >
            <Clock size={14} className={recentCount > 0 ? 'text-amber-300' : ''} />
            <span>Recent (48h)</span>
            {recentCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'recent' ? 'bg-black/20 text-white' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>
                {recentCount} New
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('syllabi')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'syllabi'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-purple-600'
            }`}
          >
            <BookOpen size={14} />
            <span>Syllabi & Schemes</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-blue-600'
            }`}
          >
            <FileText size={14} />
            <span>Lesson Notes</span>
          </button>

          <button
            onClick={() => setActiveTab('worksheets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'worksheets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-emerald-600'
            }`}
          >
            <FileCode size={14} />
            <span>Lab Sheets & Exams</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'saved'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-amber-600'
            }`}
          >
            <Bookmark size={14} />
            <span>Saved ({bookmarkedIds.length})</span>
          </button>
        </div>

        {/* View Switcher Mode */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'grid' ? 'bg-brand-slate text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Grid View"
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'table' ? 'bg-brand-slate text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Table List View"
          >
            List
          </button>
        </div>
      </div>

      {/* Filter & Sorting Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
        {/* Class Level Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Class / Age Level
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 outline-hidden focus:border-brand-red"
          >
            {CLASS_LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Subject Track
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 outline-hidden focus:border-brand-red"
          >
            {SUBJECTS.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        {/* Doc Type Filter */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Document Type
          </label>
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 outline-hidden focus:border-brand-red"
          >
            {DOC_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Automatic Sorting Selector */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Sorting Order</span>
            {sortBy === 'auto' && <span className="text-[10px] text-amber-500 font-bold">Auto 48h Top</span>}
          </label>
          <select
            id="select-sort-resources"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 outline-hidden focus:border-brand-red"
          >
            <option value="auto">⚡ Auto (Recent 48h First)</option>
            <option value="newest">🕒 Newest Uploads First</option>
            <option value="popular">🔥 Most Popular / Saved</option>
            <option value="title-asc">🔤 Title (A - Z)</option>
          </select>
        </div>
      </div>

      {/* Spotlight Callout for Recent Uploads (Shown on 'all' tab when new items exist) */}
      {activeTab === 'all' && recentCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>Recent Learning Materials Added</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                  {recentCount} New in 48h
                </span>
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Automatically categorized and prioritized at the top of your library for easy discovery.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('recent')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs self-start sm:self-auto"
          >
            View 48h Uploads
          </button>
        </div>
      )}

      {/* Results Section */}
      {filteredResources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800 p-12 text-center">
          <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search size={28} />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            No matching learning resources found
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
            Try adjusting your search query, class level, or subject track filters to discover available curriculum materials.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedClass('All Classes');
              setSelectedSubject('All Subjects');
              setSelectedDocType('All Types');
              setActiveTab('all');
            }}
            className="mt-4 px-4 py-2 bg-brand-slate text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(item => {
            const isBookmarked = bookmarkedIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => setPreviewDoc(item)}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-brand-red/40 dark:hover:border-brand-red/40 transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                {/* Top Tags & Bookmark */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getDocTypeBadge(item.docType)}`}>
                        {item.docType}
                      </span>
                      {isResourceRecent(item.dateAdded) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white flex items-center gap-1 shadow-2xs">
                          <Flame size={10} />
                          <span>Recent • {getRecentTimeLabel(item.dateAdded)}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => copyDocLink(item, e)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy Resource Link"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={(e) => toggleBookmark(item.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isBookmarked 
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' 
                            : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                        title={isBookmarked ? 'Remove Bookmark' : 'Save Resource'}
                      >
                        <Bookmark size={14} className={isBookmarked ? 'fill-current' : ''} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-brand-red transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[170px]">
                        {item.subject}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400">{item.fileSize || 'PDF Document'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <GraduationCap size={12} />
                      <span className="truncate">{item.classLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewDoc(item);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-brand-red dark:hover:text-brand-red transition-colors"
                  >
                    <Eye size={13} /> Read & Study
                  </button>

                  <button
                    onClick={(e) => handleDownload(item, e)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-slate hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table List Mode */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-950 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Document Title</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Class Level</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredResources.map(item => (
                  <tr 
                    key={item.id}
                    onClick={() => setPreviewDoc(item)}
                    className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 max-w-xs sm:max-w-sm">
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        {isResourceRecent(item.dateAdded) && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white flex items-center gap-0.5">
                            <Flame size={9} />
                            <span>Recent</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-xs">
                        {item.author || 'Academic Board'} • {item.term || 'Academic Term'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-medium">
                      {item.subject}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {item.classLevel}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getDocTypeBadge(item.docType)}`}>
                        {item.docType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-400 text-[11px]">
                      {item.fileSize || 'PDF'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setPreviewDoc(item)}
                          className="p-1.5 text-gray-500 hover:text-brand-red rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                          title="Preview Document"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={(e) => handleDownload(item, e)}
                          className="px-2.5 py-1.5 bg-brand-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                          title="Download File"
                        >
                          <Download size={12} /> Get
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Document Reader / Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gray-50/50 dark:bg-slate-950/50">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getDocTypeBadge(previewDoc.docType)}`}>
                    {previewDoc.docType}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {previewDoc.subject}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-snug">
                  {previewDoc.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span>Audience: <strong>{previewDoc.classLevel}</strong></span>
                  <span>•</span>
                  <span>Published: <strong>{previewDoc.author || 'Academic Board'}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleBookmark(previewDoc.id)}
                  className={`p-2 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors ${
                    bookmarkedIds.includes(previewDoc.id)
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-300'
                      : 'text-gray-400 hover:text-amber-500'
                  }`}
                  title="Bookmark"
                >
                  <Bookmark size={16} className={bookmarkedIds.includes(previewDoc.id) ? 'fill-current' : ''} />
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Reader View */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              
              {/* Executive Summary */}
              <div className="bg-brand-red/5 dark:bg-brand-red/10 border border-brand-red/20 rounded-2xl p-4 sm:p-5">
                <h4 className="font-extrabold text-brand-red text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} /> Module Overview & Purpose
                </h4>
                <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 mt-1 font-medium">
                  {previewDoc.content?.overview || previewDoc.description}
                </p>
              </div>

              {/* Learning Objectives */}
              {previewDoc.content?.learningObjectives && (
                <div className="space-y-3">
                  <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Key Competencies & Learning Outcomes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {previewDoc.content.learningObjectives.map((obj, i) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-slate-950 rounded-xl border border-gray-100 dark:border-slate-800 text-xs font-medium text-gray-800 dark:text-gray-200 flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lesson Notes / Concept Breakdown */}
              {previewDoc.content?.keyConcepts && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-500" /> Syllabus Breakdown & Core Concepts
                  </h3>
                  {previewDoc.content.keyConcepts.map((concept, i) => (
                    <div key={i} className="p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 space-y-2.5">
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                        {concept.heading}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                        {concept.detail}
                      </p>
                      {concept.codeSnippet && (
                        <div className="mt-2 bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
                          <pre className="whitespace-pre">{concept.codeSnippet}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Practice Challenges */}
              {previewDoc.content?.practiceExercises && (
                <div className="space-y-3 pt-2">
                  <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <Terminal size={16} className="text-purple-500" /> Practical Lab Challenges
                  </h3>
                  <div className="space-y-2">
                    {previewDoc.content.practiceExercises.map((task, i) => (
                      <div key={i} className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl text-xs text-purple-950 dark:text-purple-200 font-medium">
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => copyDocLink(previewDoc)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-brand-red flex items-center justify-center gap-1.5"
                >
                  <Copy size={13} /> Share Link
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-brand-red flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} /> Print
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="flex-1 sm:flex-none px-5 py-2 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download PDF Package
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceLibrary;
