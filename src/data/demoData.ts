import type {
  Affectation,
  AffectationLine,
  CaisseTransaction,
  Department,
  Expense,
  LocalUser,
  Product,
  Purchase,
  PurchaseLine,
  StoreSettings,
  Supplier,
  Worker,
} from '@/types'
import type { Snapshot } from '@/lib/database'
import { hashPassword } from '@/lib/password'
import { round2 } from '@/utils/helpers'

// ============================================================================
// Demo version — constant test data for every screen.
//
// Loaded automatically into an empty database, and on demand from the login
// page ("Connexion démo") or Settings. Dates are relative to today so the demo
// always looks fresh. Stock quantities are derived from the purchases and the
// affectations below, so every screen stays consistent.
// ============================================================================

export const DEMO_EMAIL = 'demo@altech.dz'
export const DEMO_USERNAME = 'demo'
export const DEMO_PASSWORD = 'demo1234'
export const DEMO_USER_ID = 'u-demo-admin'
const DEMO_SALT = 'altech-demo-salt-2026'

export const demoAdminUser = (): LocalUser => ({
  id: DEMO_USER_ID,
  role: 'admin',
  fullName: 'Administrateur Démo',
  username: DEMO_USERNAME,
  email: DEMO_EMAIL,
  salt: DEMO_SALT,
  passwordHash: hashPassword(DEMO_PASSWORD, DEMO_SALT),
  createdAt: new Date().toISOString(),
})

// --- date helpers ------------------------------------------------------------
const now = new Date()
const daysAgo = (n: number, hour = 10): string => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, hour, 15)
  return d.toISOString()
}
const dateInDays = (n: number): string => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 12)
  return d.toISOString().slice(0, 10)
}
const monthKeyAgo = (n: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// --- reference lists ---------------------------------------------------------
const CATEGORIES = [
  'Fournitures de bureau',
  'Informatique',
  "Consommables d'impression",
  'Mobilier',
  "Produits d'entretien",
  'Électricité',
]
const BRANDS = ['Bic', 'HP', 'Canon', 'Dell', 'Logitech', 'Clairefontaine', 'Ikea Pro', 'Javel La Croix', 'Legrand', 'Générique']
const UNITS = ['ramette', 'carton', 'pièce', 'boîte', 'litre']

// --- products (initial quantity = stock before the demo purchases) -----------
interface Seed {
  id: string
  name: string
  description: string
  barcode: string
  brand: string
  category: string
  purchasePrice: number
  minQuantity: number
  initial: number
  stockUnit?: string
  expirationDate?: string
}

const SEEDS: Seed[] = [
  { id: 'p-ramette', name: 'Ramette papier A4 80g', description: 'Papier blanc 500 feuilles, usage courant.', barcode: '6130001000017', brand: 'Clairefontaine', category: 'Fournitures de bureau', purchasePrice: 750, minQuantity: 40, initial: 60, stockUnit: 'ramette' },
  { id: 'p-stylo', name: 'Stylo bille bleu (boîte de 50)', description: 'Stylo à bille pointe moyenne, encre bleue.', barcode: '6130001000024', brand: 'Bic', category: 'Fournitures de bureau', purchasePrice: 1500, minQuantity: 5, initial: 8, stockUnit: 'boîte' },
  { id: 'p-classeur', name: 'Classeur à levier dos 8 cm', description: 'Classeur carton rigide, coloris assortis.', barcode: '6130001000031', brand: 'Générique', category: 'Fournitures de bureau', purchasePrice: 320, minQuantity: 30, initial: 45 },
  { id: 'p-agrafeuse', name: 'Agrafeuse de bureau', description: 'Agrafeuse métal 25 feuilles + agrafes 24/6.', barcode: '6130001000048', brand: 'Générique', category: 'Fournitures de bureau', purchasePrice: 900, minQuantity: 6, initial: 10 },
  { id: 'p-laptop', name: 'Ordinateur portable Latitude 5540', description: 'Core i5, 16 Go RAM, SSD 512 Go, 15,6".', barcode: '6130002000016', brand: 'Dell', category: 'Informatique', purchasePrice: 145000, minQuantity: 2, initial: 3 },
  { id: 'p-ecran', name: 'Écran 24" Full HD', description: 'Moniteur IPS 24 pouces, HDMI / DisplayPort.', barcode: '6130002000023', brand: 'Dell', category: 'Informatique', purchasePrice: 32000, minQuantity: 3, initial: 4 },
  { id: 'p-souris', name: 'Souris sans fil M185', description: 'Souris optique sans fil, récepteur USB.', barcode: '6130002000030', brand: 'Logitech', category: 'Informatique', purchasePrice: 2200, minQuantity: 10, initial: 12 },
  { id: 'p-clavier', name: 'Clavier USB AZERTY', description: 'Clavier filaire résistant aux éclaboussures.', barcode: '6130002000047', brand: 'Logitech', category: 'Informatique', purchasePrice: 2600, minQuantity: 8, initial: 6 },
  { id: 'p-imprimante', name: 'Imprimante laser LaserJet M211', description: 'Laser monochrome, Wi-Fi, recto-verso.', barcode: '6130002000054', brand: 'HP', category: 'Informatique', purchasePrice: 38000, minQuantity: 1, initial: 2 },
  { id: 'p-toner', name: 'Toner HP 135A noir', description: 'Cartouche laser ~1 100 pages.', barcode: '6130003000015', brand: 'HP', category: "Consommables d'impression", purchasePrice: 9500, minQuantity: 6, initial: 5 },
  { id: 'p-encre', name: 'Cartouche jet d\'encre Canon PG-545', description: 'Cartouche noire pour multifonctions Pixma.', barcode: '6130003000022', brand: 'Canon', category: "Consommables d'impression", purchasePrice: 3200, minQuantity: 8, initial: 10 },
  { id: 'p-bureau', name: 'Bureau de travail 140 x 70', description: 'Plateau mélaminé, piètement métal.', barcode: '6130004000014', brand: 'Ikea Pro', category: 'Mobilier', purchasePrice: 24000, minQuantity: 2, initial: 4 },
  { id: 'p-chaise', name: 'Chaise de bureau ergonomique', description: 'Dossier résille, accoudoirs réglables.', barcode: '6130004000021', brand: 'Ikea Pro', category: 'Mobilier', purchasePrice: 15500, minQuantity: 4, initial: 6 },
  { id: 'p-armoire', name: 'Armoire métallique à archives', description: '2 portes battantes, 4 étagères, serrure.', barcode: '6130004000038', brand: 'Générique', category: 'Mobilier', purchasePrice: 42000, minQuantity: 1, initial: 1 },
  { id: 'p-javel', name: 'Eau de Javel 5 L', description: 'Désinfectant multi-usage, bidon 5 litres.', barcode: '6130005000013', brand: 'Javel La Croix', category: "Produits d'entretien", purchasePrice: 450, minQuantity: 15, initial: 20, stockUnit: 'litre', expirationDate: dateInDays(18) },
  { id: 'p-savon', name: 'Savon liquide mains 1 L', description: 'Savon antibactérien, flacon pompe.', barcode: '6130005000020', brand: 'Générique', category: "Produits d'entretien", purchasePrice: 380, minQuantity: 20, initial: 25, expirationDate: dateInDays(240) },
  { id: 'p-sacs', name: 'Sacs poubelle 100 L (rouleau)', description: 'Rouleau de 10 sacs renforcés.', barcode: '6130005000037', brand: 'Générique', category: "Produits d'entretien", purchasePrice: 280, minQuantity: 20, initial: 30 },
  { id: 'p-ampoule', name: 'Ampoule LED E27 12 W', description: 'Lumière blanche neutre 4000 K.', barcode: '6130006000012', brand: 'Legrand', category: 'Électricité', purchasePrice: 350, minQuantity: 25, initial: 40 },
  { id: 'p-multiprise', name: 'Multiprise 5 prises + interrupteur', description: 'Câble 3 m, protection parafoudre.', barcode: '6130006000029', brand: 'Legrand', category: 'Électricité', purchasePrice: 1800, minQuantity: 6, initial: 8 },
  { id: 'p-gel', name: 'Gel hydroalcoolique 500 ml', description: 'Solution désinfectante pour les mains.', barcode: '6130005000044', brand: 'Générique', category: "Produits d'entretien", purchasePrice: 420, minQuantity: 15, initial: 4, expirationDate: dateInDays(-5) },
]

const seedById = new Map(SEEDS.map((s) => [s.id, s]))

// --- suppliers ---------------------------------------------------------------
const SUPPLIERS: Supplier[] = [
  { id: 'sup-bureautique', name: 'Bureautique Algérie SARL', phone: '0550 12 34 56', address: 'Zone industrielle, Rouiba, Alger', createdAt: daysAgo(200) },
  { id: 'sup-infotech', name: 'InfoTech Solutions', phone: '0661 45 78 90', address: 'Rue Didouche Mourad, Alger-Centre', createdAt: daysAgo(190) },
  { id: 'sup-mobilier', name: 'Mobilier Pro Est', phone: '0770 33 22 11', address: 'Cité des 500 logements, Constantine', createdAt: daysAgo(180) },
  { id: 'sup-hygiene', name: 'Hygiène & Services', phone: '0555 98 76 54', address: 'Bd Zighoud Youcef, Oran', createdAt: daysAgo(170) },
  { id: 'sup-elec', name: 'ElecDistri', phone: '0662 11 00 99', address: 'Route nationale 5, Sétif', createdAt: daysAgo(160) },
]
const supplierName = (id: string) => SUPPLIERS.find((s) => s.id === id)?.name ?? ''

// --- purchases ---------------------------------------------------------------
interface PurchaseSeed {
  id: string
  supplierId: string
  daysAgo: number
  paidRatio: number
  lines: [string, number][]
}
const PURCHASE_SEEDS: PurchaseSeed[] = [
  { id: 'pu-1', supplierId: 'sup-bureautique', daysAgo: 150, paidRatio: 1, lines: [['p-ramette', 100], ['p-stylo', 10], ['p-classeur', 40]] },
  { id: 'pu-2', supplierId: 'sup-infotech', daysAgo: 130, paidRatio: 1, lines: [['p-laptop', 6], ['p-ecran', 8], ['p-souris', 20]] },
  { id: 'pu-3', supplierId: 'sup-mobilier', daysAgo: 110, paidRatio: 1, lines: [['p-bureau', 6], ['p-chaise', 12], ['p-armoire', 3]] },
  { id: 'pu-4', supplierId: 'sup-hygiene', daysAgo: 85, paidRatio: 1, lines: [['p-javel', 40], ['p-savon', 40], ['p-sacs', 50], ['p-gel', 30]] },
  { id: 'pu-5', supplierId: 'sup-infotech', daysAgo: 60, paidRatio: 0.6, lines: [['p-imprimante', 3], ['p-toner', 12], ['p-encre', 10], ['p-clavier', 10]] },
  { id: 'pu-6', supplierId: 'sup-elec', daysAgo: 40, paidRatio: 1, lines: [['p-ampoule', 60], ['p-multiprise', 10]] },
  { id: 'pu-7', supplierId: 'sup-bureautique', daysAgo: 18, paidRatio: 0.5, lines: [['p-ramette', 80], ['p-agrafeuse', 8], ['p-stylo', 6]] },
  { id: 'pu-8', supplierId: 'sup-hygiene', daysAgo: 4, paidRatio: 0, lines: [['p-javel', 20], ['p-savon', 15]] },
]

const MARGIN = 1.25 // reference value only (no selling in this version)

const PURCHASES: Purchase[] = PURCHASE_SEEDS.map((p, i) => {
  const lines: PurchaseLine[] = p.lines.map(([productId, quantity]) => {
    const s = seedById.get(productId)!
    return {
      productId,
      productName: s.name,
      barcode: s.barcode,
      quantity,
      purchasePrice: s.purchasePrice,
      salePrice: round2(s.purchasePrice * MARGIN),
      minQuantity: s.minQuantity,
      hasExpiration: !!s.expirationDate,
      expirationDate: s.expirationDate,
    }
  })
  const total = round2(lines.reduce((sum, l) => sum + l.quantity * l.purchasePrice, 0))
  const paid = round2(total * p.paidRatio)
  const date = daysAgo(p.daysAgo)
  return {
    id: p.id,
    reference: `ACH-${new Date(date).getFullYear()}-${String(i + 1).padStart(3, '0')}`,
    supplierId: p.supplierId,
    supplierName: supplierName(p.supplierId),
    lines,
    total,
    paid,
    payments: paid > 0 ? [{ id: `pay-${p.id}`, amount: paid, date, note: 'Règlement par virement' }] : [],
    date,
    createdAt: date,
  }
})

// --- departments ---------------------------------------------------------------
const DEPARTMENTS: Department[] = [
  { id: 'dep-dg', name: 'Direction Générale', code: 'DG', description: 'Direction, secrétariat général et cabinet.', manager: 'M. Karim Benali', phone: '023 45 10 00', email: 'dg@organisme.dz', location: 'Bâtiment A — 3e étage', createdAt: daysAgo(200) },
  { id: 'dep-rh', name: 'Ressources Humaines', code: 'DRH', description: 'Gestion du personnel, paie et formation.', manager: 'Mme Samia Haddad', phone: '023 45 10 12', email: 'rh@organisme.dz', location: 'Bâtiment A — 2e étage', createdAt: daysAgo(200) },
  { id: 'dep-fin', name: 'Finances & Comptabilité', code: 'DFC', description: 'Budget, comptabilité publique et marchés.', manager: 'M. Yacine Ouali', phone: '023 45 10 20', email: 'finances@organisme.dz', location: 'Bâtiment A — 1er étage', createdAt: daysAgo(198) },
  { id: 'dep-info', name: 'Service Informatique', code: 'SI', description: 'Parc informatique, réseau et support utilisateurs.', manager: 'M. Amine Ziani', phone: '023 45 10 30', email: 'si@organisme.dz', location: 'Bâtiment B — RDC', createdAt: daysAgo(195) },
  { id: 'dep-moyens', name: 'Moyens Généraux', code: 'DMG', description: 'Entretien des locaux, logistique et sécurité.', manager: 'M. Rachid Meziane', phone: '023 45 10 40', email: 'mg@organisme.dz', location: 'Bâtiment C', createdAt: daysAgo(195) },
  { id: 'dep-accueil', name: 'Accueil & Relations publiques', code: 'ARP', description: 'Accueil des citoyens et guichet unique.', manager: 'Mme Nadia Kaci', phone: '023 45 10 01', email: 'accueil@organisme.dz', location: 'Hall principal', createdAt: daysAgo(190) },
]
const depName = (id: string) => DEPARTMENTS.find((d) => d.id === id)?.name ?? ''

// --- affectations ------------------------------------------------------------
interface AffSeed {
  departmentId: string
  daysAgo: number
  description: string
  receivedBy: string
  lines: [string, number][]
  edited?: string
}
const AFF_SEEDS: AffSeed[] = [
  { departmentId: 'dep-info', daysAgo: 125, description: 'Équipement des nouveaux postes du service.', receivedBy: 'Amine Ziani', lines: [['p-laptop', 3], ['p-ecran', 4], ['p-souris', 6]] },
  { departmentId: 'dep-dg', daysAgo: 120, description: 'Dotation trimestrielle en fournitures.', receivedBy: 'Lynda Saadi', lines: [['p-ramette', 20], ['p-stylo', 3], ['p-classeur', 10]] },
  { departmentId: 'dep-rh', daysAgo: 105, description: 'Aménagement du bureau de recrutement.', receivedBy: 'Samia Haddad', lines: [['p-bureau', 2], ['p-chaise', 4]] },
  { departmentId: 'dep-moyens', daysAgo: 80, description: 'Produits d\'entretien — mois en cours.', receivedBy: 'Rachid Meziane', lines: [['p-javel', 25], ['p-savon', 20], ['p-sacs', 30]], edited: 'Quantité de sacs ajustée après inventaire.' },
  { departmentId: 'dep-fin', daysAgo: 70, description: 'Archivage des pièces comptables de l\'exercice.', receivedBy: 'Yacine Ouali', lines: [['p-armoire', 2], ['p-classeur', 15], ['p-ramette', 15]] },
  { departmentId: 'dep-accueil', daysAgo: 55, description: 'Guichet unique — matériel d\'accueil.', receivedBy: 'Nadia Kaci', lines: [['p-chaise', 4], ['p-gel', 20], ['p-ramette', 10]] },
  { departmentId: 'dep-info', daysAgo: 50, description: 'Imprimantes partagées pour les étages.', receivedBy: 'Amine Ziani', lines: [['p-imprimante', 2], ['p-toner', 6], ['p-clavier', 4]] },
  { departmentId: 'dep-moyens', daysAgo: 35, description: 'Remplacement de l\'éclairage des couloirs.', receivedBy: 'Rachid Meziane', lines: [['p-ampoule', 45], ['p-multiprise', 4]] },
  { departmentId: 'dep-rh', daysAgo: 25, description: 'Fournitures pour la session de formation.', receivedBy: 'Samia Haddad', lines: [['p-ramette', 25], ['p-stylo', 4], ['p-souris', 6]] },
  { departmentId: 'dep-dg', daysAgo: 14, description: 'Renouvellement de matériel de la direction.', receivedBy: 'Lynda Saadi', lines: [['p-laptop', 2], ['p-ecran', 2], ['p-agrafeuse', 3]], edited: 'Ajout de 3 agrafeuses à la demande du secrétariat.' },
  { departmentId: 'dep-fin', daysAgo: 9, description: 'Consommables d\'impression du service.', receivedBy: 'Yacine Ouali', lines: [['p-toner', 5], ['p-encre', 6], ['p-ramette', 30]] },
  { departmentId: 'dep-moyens', daysAgo: 5, description: 'Produits d\'hygiène — sanitaires.', receivedBy: 'Rachid Meziane', lines: [['p-javel', 18], ['p-savon', 22], ['p-sacs', 24], ['p-gel', 8]] },
  { departmentId: 'dep-accueil', daysAgo: 2, description: 'Fournitures du guichet.', receivedBy: 'Nadia Kaci', lines: [['p-stylo', 2], ['p-classeur', 12], ['p-agrafeuse', 2]] },
  { departmentId: 'dep-info', daysAgo: 0, description: 'Postes pour deux nouveaux techniciens.', receivedBy: 'Amine Ziani', lines: [['p-clavier', 3], ['p-souris', 4], ['p-multiprise', 2]] },
]

const AFFECTATIONS: Affectation[] = AFF_SEEDS.map((a, i) => {
  const lines: AffectationLine[] = a.lines.map(([productId, quantity]) => {
    const s = seedById.get(productId)!
    return { productId, productName: s.name, barcode: s.barcode, quantity, unitCost: s.purchasePrice }
  })
  const date = daysAgo(a.daysAgo, 9 + (i % 6))
  const history: Affectation['history'] = [
    { id: `ev-${i}-c`, type: 'created', date, by: 'Administrateur Démo', note: a.description },
  ]
  if (a.edited)
    history.push({ id: `ev-${i}-u`, type: 'updated', date: daysAgo(Math.max(0, a.daysAgo - 1), 15), by: 'Administrateur Démo', note: a.edited })
  return {
    id: `aff-${i + 1}`,
    reference: `AFF-${new Date(date).getFullYear()}-${String(i + 1).padStart(3, '0')}`,
    departmentId: a.departmentId,
    departmentName: depName(a.departmentId),
    lines,
    description: a.description,
    receivedBy: a.receivedBy,
    total: round2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)),
    date,
    history,
    createdBy: 'Administrateur Démo',
    createdAt: date,
  }
})

// --- products with consistent quantities --------------------------------------
const PRODUCTS: Product[] = SEEDS.map((s, i) => {
  const purchased = PURCHASES.reduce(
    (sum, p) => sum + p.lines.filter((l) => l.productId === s.id).reduce((x, l) => x + l.quantity, 0),
    0,
  )
  const affected = AFFECTATIONS.reduce(
    (sum, a) => sum + a.lines.filter((l) => l.productId === s.id).reduce((x, l) => x + l.quantity, 0),
    0,
  )
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    barcode: s.barcode,
    brand: s.brand,
    category: s.category,
    purchasePrice: s.purchasePrice,
    salePrice: round2(s.purchasePrice * MARGIN),
    quantity: Math.max(0, s.initial + purchased - affected),
    minQuantity: s.minQuantity,
    stockUnit: s.stockUnit,
    hasExpiration: !!s.expirationDate,
    expirationDate: s.expirationDate,
    createdAt: daysAgo(200 - i),
  }
})

// --- workers -------------------------------------------------------------------
const worker = (w: Partial<Worker> & Pick<Worker, 'id' | 'fullName' | 'role' | 'salaryAmount'>): Worker => ({
  birthDate: '1988-04-12',
  idCard: '',
  phone: '',
  hasSalary: true,
  salaryType: 'monthly',
  hasAccount: false,
  email: '',
  username: '',
  password: '',
  permissions: {},
  startDate: daysAgo(400).slice(0, 10),
  active: true,
  advances: [],
  absences: [],
  payments: [],
  createdAt: daysAgo(400),
  ...w,
})

const monthlyPayments = (id: string, amount: number, months: number[]) =>
  months.map((m) => ({
    id: `wp-${id}-${m}`,
    period: monthKeyAgo(m),
    baseSalary: amount,
    absencesDeducted: 0,
    advancesDeducted: 0,
    amount,
    date: daysAgo(m * 30 + 2),
    note: `Salaire ${monthKeyAgo(m)}`,
  }))

const WORKERS: Worker[] = [
  worker({
    id: 'w-magasinier',
    fullName: 'Sofiane Belkacem',
    role: 'Magasinier',
    phone: '0550 44 55 66',
    idCard: '109876543210',
    salaryAmount: 52000,
    payments: monthlyPayments('mag', 52000, [1, 2, 3]),
    advances: [{ id: 'adv-1', date: daysAgo(8), description: 'Avance sur salaire', amount: 8000, deducted: false }],
  }),
  worker({
    id: 'w-gestionnaire',
    fullName: 'Imane Cherif',
    role: 'Gestionnaire de stock',
    phone: '0661 22 33 44',
    idCard: '109876543227',
    salaryAmount: 65000,
    payments: monthlyPayments('ges', 65000, [1, 2, 3]),
  }),
  worker({
    id: 'w-agent',
    fullName: 'Walid Mansouri',
    role: 'Agent logistique',
    phone: '0770 66 77 88',
    salaryType: 'daily',
    salaryAmount: 1800,
    payments: monthlyPayments('agt', 46800, [1, 2]),
    absences: [{ id: 'abs-1', date: daysAgo(12), description: 'Absence non justifiée', cost: 1800 }],
    advances: [{ id: 'adv-2', date: daysAgo(20), description: 'Avance exceptionnelle', amount: 5000, deducted: false }],
  }),
  worker({
    id: 'w-chauffeur',
    fullName: 'Hocine Amrani',
    role: 'Chauffeur',
    phone: '0555 10 20 30',
    salaryAmount: 48000,
    active: false,
    payments: monthlyPayments('chf', 48000, [3, 4]),
  }),
]

// --- expenses ----------------------------------------------------------------
const EXPENSES: Expense[] = [
  { id: 'ex-1', name: 'Transport de marchandises', description: 'Livraison du mobilier — Constantine → Alger.', amount: 18000, date: daysAgo(108), createdAt: daysAgo(108) },
  { id: 'ex-2', name: 'Maintenance chariot élévateur', description: 'Révision annuelle du chariot du magasin.', amount: 26500, date: daysAgo(75), createdAt: daysAgo(75) },
  { id: 'ex-3', name: 'Électricité entrepôt', description: 'Facture Sonelgaz — trimestre.', amount: 34200, date: daysAgo(45), createdAt: daysAgo(45) },
  { id: 'ex-4', name: 'Étiquettes code-barres', description: '5 rouleaux d\'étiquettes thermiques.', amount: 6500, date: daysAgo(30), createdAt: daysAgo(30) },
  { id: 'ex-5', name: 'Réparation rayonnages', description: 'Remplacement de 4 étagères endommagées.', amount: 15800, date: daysAgo(16), createdAt: daysAgo(16) },
  { id: 'ex-6', name: 'Carburant véhicule de service', description: 'Bons d\'essence du mois.', amount: 12000, date: daysAgo(6), createdAt: daysAgo(6) },
  { id: 'ex-7', name: 'Frais de mission', description: 'Déplacement pour réception de commande.', amount: 7400, date: daysAgo(1), createdAt: daysAgo(1) },
]

// --- budget movements --------------------------------------------------------
const BUDGET: CaisseTransaction[] = [
  { id: 'bg-1', type: 'deposit', amount: 2500000, description: 'Dotation budgétaire — exercice en cours (tranche 1)', date: daysAgo(160), createdAt: daysAgo(160) },
  { id: 'bg-2', type: 'deposit', amount: 1200000, description: 'Dotation budgétaire — tranche 2', date: daysAgo(70), createdAt: daysAgo(70) },
  { id: 'bg-3', type: 'withdrawal', amount: 150000, description: 'Reversement au Trésor — reliquat', date: daysAgo(65), createdAt: daysAgo(65) },
  { id: 'bg-4', type: 'deposit', amount: 400000, description: 'Crédit complémentaire — équipement informatique', date: daysAgo(20), createdAt: daysAgo(20) },
  { id: 'bg-5', type: 'withdrawal', amount: 60000, description: 'Régie d\'avances — menues dépenses', date: daysAgo(3), createdAt: daysAgo(3) },
]

const SETTINGS: StoreSettings = {
  logo: '',
  name: 'Organisme Public — Démo',
  description: 'Magasin central — gestion des stocks et des affectations',
  email: 'magasin@organisme.dz',
  phone: '023 45 10 50',
  address: 'Cité administrative, Alger',
  nif: '000016001234567',
  nis: '000016019876543',
  article: '16012345678',
  rc: '—',
  currency: 'DA',
}

/** The complete demonstration database. */
export const buildDemoSnapshot = (): Snapshot => ({
  products: PRODUCTS,
  brands: BRANDS,
  categories: CATEGORIES,
  units: UNITS,
  suppliers: SUPPLIERS,
  purchases: PURCHASES,
  departments: DEPARTMENTS,
  affectations: AFFECTATIONS,
  workers: WORKERS,
  workerRoles: ['Magasinier', 'Gestionnaire de stock', 'Agent logistique', 'Chauffeur'],
  expenses: EXPENSES,
  caisse: BUDGET,
  settings: SETTINGS,
  users: [demoAdminUser()],
})
