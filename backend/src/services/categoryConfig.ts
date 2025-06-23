import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CategoryConfig {
  type: string;
  filters: string[];
  enabled: boolean;
}

// Default search categories
const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    type: 'PARK',
    filters: [
      'leisure=park',
      'leisure=garden',
      'leisure=nature_reserve',
      'leisure=recreation_ground',
      'leisure=common',
      'leisure=dog_park',
      'landuse=recreation_ground',
      'landuse=village_green'
    ],
    enabled: true
  },
  {
    type: 'TOURIST_ATTRACTION',
    filters: [
      'tourism=attraction',
      'tourism=museum',
      'tourism=viewpoint',
      'tourism=castle',
      'tourism=monument',
      'tourism=gallery',
      'tourism=zoo',
      'tourism=theme_park',
      'tourism=artwork',
      'historic=castle',
      'historic=monument',
      'historic=memorial',
      'historic=ruins',
      'historic=archaeological_site',
      'amenity=theatre',
      'amenity=cinema',
      'amenity=library',
      'amenity=community_centre'
    ],
    enabled: true
  },
  {
    type: 'TOWN',
    filters: [
      'place=town',
      'place=village',
      'place=hamlet',
      'place=suburb',
      'place=neighbourhood'
    ],
    enabled: true
  },
  {
    type: 'CITY',
    filters: [
      'place=city'
    ],
    enabled: true
  },
  {
    type: 'PLAYGROUND',
    filters: [
      'leisure=playground',
      'amenity=playground'
    ],
    enabled: true
  }
];

export async function getSearchCategories(): Promise<CategoryConfig[]> {
  try {
    const categoriesSetting = await prisma.setting.findFirst({
      where: { key: 'search_categories' }
    });

    if (categoriesSetting && categoriesSetting.value) {
      try {
        return JSON.parse(categoriesSetting.value);
      } catch (error) {
        console.error('Failed to parse search categories from database, using defaults:', error);
        return DEFAULT_CATEGORIES;
      }
    }

    // No categories in database, seed with defaults
    await seedSearchCategories();
    return DEFAULT_CATEGORIES;
  } catch (error) {
    console.error('Failed to get search categories from database, using defaults:', error);
    return DEFAULT_CATEGORIES;
  }
}

export async function updateSearchCategories(categories: CategoryConfig[]): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key: 'search_categories' },
      update: { value: JSON.stringify(categories, null, 2) },
      create: { 
        key: 'search_categories',
        value: JSON.stringify(categories, null, 2)
      }
    });
  } catch (error) {
    console.error('Failed to update search categories:', error);
    throw error;
  }
}

export async function addSearchCategory(category: CategoryConfig): Promise<void> {
  const categories = await getSearchCategories();
  
  // Remove existing category with same type
  const filteredCategories = categories.filter(c => c.type !== category.type);
  
  // Add new category
  filteredCategories.push(category);
  
  await updateSearchCategories(filteredCategories);
}

export async function removeSearchCategory(type: string): Promise<void> {
  const categories = await getSearchCategories();
  const filteredCategories = categories.filter(c => c.type !== type);
  await updateSearchCategories(filteredCategories);
}

export async function toggleSearchCategory(type: string, enabled: boolean): Promise<void> {
  const categories = await getSearchCategories();
  const category = categories.find(c => c.type === type);
  
  if (category) {
    category.enabled = enabled;
    await updateSearchCategories(categories);
  }
}

async function seedSearchCategories(): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key: 'search_categories' },
      update: {
        value: JSON.stringify(DEFAULT_CATEGORIES, null, 2)
      },
      create: {
        key: 'search_categories',
        value: JSON.stringify(DEFAULT_CATEGORIES, null, 2)
      }
    });
    console.log('✅ Seeded default search categories');
  } catch (error) {
    console.log('Failed to seed search categories:', error);
  }
}

export { DEFAULT_CATEGORIES }; 