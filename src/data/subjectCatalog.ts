export interface SubjectItem {
  id: string;
  name: string;
  category: 'school' | 'vocational' | 'digital' | 'programming';
  subcategory?: string;
  description?: string;
  iconName?: string;
  popular?: boolean;
}

export interface SubjectCategory {
  id: 'school' | 'vocational' | 'digital' | 'programming';
  title: string;
  description: string;
  badge: string;
  color: string;
  subcategories?: {
    name: string;
    subjects: string[];
  }[];
  subjects: string[];
}

export const SUBJECT_TAXONOMY: SubjectCategory[] = [
  {
    id: 'school',
    title: 'School Curriculum Subjects',
    description: 'Core foundational, primary, junior and senior secondary academic courses.',
    badge: 'Academics',
    color: 'emerald',
    subjects: [
      'Mathematics',
      'Further Mathematics',
      'English Language',
      'Literature in English',
      'Physics',
      'Chemistry',
      'Biology',
      'Basic Science',
      'Agricultural Science',
      'Economics',
      'Government',
      'Commerce',
      'Civic Education',
      'History & Social Studies',
      'French Language',
      'Geography'
    ]
  },
  {
    id: 'vocational',
    title: 'Vocational & Creative Arts',
    description: 'Hands-on creative, musical, expression, and vocational disciplines.',
    badge: 'Vocational',
    color: 'purple',
    subjects: [
      'Music (Piano & Keyboard)',
      'Music (Acoustic & Electric Guitar)',
      'Music (Vocal Training & Solfa)',
      'Music (Music Theory & Sight Reading)',
      'Fine Arts & Drawing',
      'Arts and Crafts',
      'Photography & Cinematography',
      'Creative Writing & Storytelling',
      'Public Speaking, Diction & Debate',
      'Chess & Strategic Logic'
    ]
  },
  {
    id: 'digital',
    title: 'Digital & Creative Skills',
    description: 'Modern digital design, computer productivity, and digital literacy skills.',
    badge: 'Digital Skills',
    color: 'amber',
    subjects: [
      'Graphic Design (Photoshop & Canva)',
      'UI/UX Design (Figma & Wireframing)',
      'Microsoft Office Suite (Word, Excel, PowerPoint)',
      'Digital Literacy & Internet Safety',
      'AI Education & Prompt Engineering',
      '2D Animation & Motion Graphics',
      'Video Editing & Content Creation'
    ]
  },
  {
    id: 'programming',
    title: 'Programming & Software Development',
    description: 'Software development tracks, coding languages, and developer frameworks.',
    badge: 'Coding & Tech',
    color: 'blue',
    subcategories: [
      {
        name: 'Development Specialization Tracks',
        subjects: [
          'Web Development (Frontend & Fullstack)',
          'Mobile App Development',
          'Game Development (Scratch, Roblox & 2D Games)',
          'Data Science & Analytics',
          'Software Engineering Fundamentals'
        ]
      },
      {
        name: 'Programming Languages & Frameworks',
        subjects: [
          'Python Programming',
          'HTML5 & Modern CSS3',
          'JavaScript (ES6+)',
          'TypeScript & React Framework',
          'PHP & MySQL Backend',
          'Scratch & Visual Block Coding',
          'C++ Programming',
          'Java Programming',
          'Node.js & REST APIs',
          'Database Design & SQL'
        ]
      }
    ],
    subjects: [
      'Web Development (Frontend & Fullstack)',
      'Mobile App Development',
      'Game Development (Scratch, Roblox & 2D Games)',
      'Data Science & Analytics',
      'Software Engineering Fundamentals',
      'Python Programming',
      'HTML5 & Modern CSS3',
      'JavaScript (ES6+)',
      'TypeScript & React Framework',
      'PHP & MySQL Backend',
      'Scratch & Visual Block Coding',
      'C++ Programming',
      'Java Programming',
      'Node.js & REST APIs',
      'Database Design & SQL'
    ]
  }
];

// Flat list of all subject names
export const ALL_AVAILABLE_SUBJECTS: string[] = Array.from(
  new Set(SUBJECT_TAXONOMY.flatMap(cat => cat.subjects))
);

// Helper to find category by subject name
export const getSubjectCategory = (subjectName: string): SubjectCategory => {
  for (const cat of SUBJECT_TAXONOMY) {
    if (cat.subjects.some(s => s.toLowerCase() === subjectName.toLowerCase())) {
      return cat;
    }
  }
  // Default match by keyword
  const lower = subjectName.toLowerCase();
  if (lower.includes('code') || lower.includes('python') || lower.includes('web') || lower.includes('react') || lower.includes('dev')) {
    return SUBJECT_TAXONOMY[3]; // programming
  }
  if (lower.includes('design') || lower.includes('office') || lower.includes('ai') || lower.includes('digital')) {
    return SUBJECT_TAXONOMY[2]; // digital
  }
  if (lower.includes('music') || lower.includes('art') || lower.includes('craft') || lower.includes('chess') || lower.includes('photo')) {
    return SUBJECT_TAXONOMY[1]; // vocational
  }
  return SUBJECT_TAXONOMY[0]; // school
};
