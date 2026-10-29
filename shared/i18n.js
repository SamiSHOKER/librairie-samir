// Arabic / French / English. Missing keys fall back to English.
const D = {
en: {
  // shell
  staffApp: "Shop", ownerApp: "Owner",
  home: "Home", sell: "Sell", stock: "Stock", repairs: "Repairs", customers: "Customers", receipts: "Receipts",
  more: "More", reports: "Reports", orders: "Orders", suppliers: "Suppliers", schools: "Schools", team: "Team", settings: "Settings",
  logout: "Log out", loading: "Loading…", retry: "Try again", save: "Save", cancel: "Cancel", close: "Close", delete: "Delete",
  confirmDelete: "Tap again to confirm", add: "Add", edit: "Edit", search: "Search", none: "None", all: "All", yes: "Yes", no: "No",
  saved: "Saved", errSave: "Could not save. Check the internet connection and try again.", errLoad: "Could not load. Check the internet connection.",
  offline: "No internet connection. Sales can't be saved until it's back.",
  // login
  login: "Log in", username: "Username or email", password: "Password", wrongLogin: "Wrong username or password.",
  noAccess: "This account is waiting for an owner to give it access.", ownerOnly: "This app is for owners. Use the Shop app.",
  createOwner: "First time? Create the owner account", email: "Email", fullName: "Full name", createAccount: "Create account",
  haveAccount: "I already have an account", ownerCreated: "Owner account created.",
  // money
  usdShort: "$", ll: "LL",
  // sell
  scanSearch: "Scan or search by name or barcode", scan: "Scan", customItem: "Custom item", customHint: "Photocopies, printing, repair labour…",
  cartEmpty: "Scan a barcode or search to add items.", subtotal: "Subtotal", discount: "Discount ($)", total: "Total",
  paidUsd: "Paid in $", paidLbp: "Paid in LL", change: "Change to give", due: "Still to pay", customer: "Customer",
  chooseCustomer: "Add customer", walkIn: "Walk-in customer", onAccount: "Put the unpaid part on the customer's account",
  completeSale: "Complete sale", saleDone: "Sale saved", newSale: "New sale", downloadPdf: "Download PDF", share: "Share",
  receiptNo: "Receipt", price: "Price", qty: "Qty", unitPrice: "Unit price ($)", fromRepair: "From repair job",
  notFoundCreate: "No product with this barcode. Create it?", outOfStockWarn: "Stock is already 0 for", owes: "owes",
  // stock
  addProduct: "Add product", lowStock: "Low stock", outOfStock: "Out of stock", name: "Name", barcode: "Barcode", category: "Category",
  kind: "Type", kindItem: "Item in stock", kindService: "Service (no stock)", priceUsd: "Selling price ($)", quantity: "Quantity in stock",
  minQty: "Alert when at or below", costUsd: "Cost price ($)", supplier: "Supplier", margin: "Margin", active: "Active",
  priceLocked: "Only owners can change the price.", adjust: "Change stock", received: "Received", removed: "Damaged / lost", counted: "Counted",
  apply: "Apply", history: "Stock history", items: "items", noProducts: "No products yet. Add them one by one or scan their barcodes.",
  duplicateBarcode: "Another product already has this barcode.", archive: "Hide product", hidden: "Hidden",
  // customers
  addCustomer: "Add customer", phone: "Phone", notes: "Notes", balance: "Balance owed", takePayment: "Record payment",
  amountUsd: "Amount ($)", paymentSaved: "Payment recorded", purchases: "Purchases", noCustomers: "No customers yet.",
  // repairs
  newJob: "New repair job", job: "Job", bike: "Bike", bikeHint: "Brand, colour, size", problem: "Problem", labour: "Labour ($)",
  parts: "Parts used", addPart: "Add part", status: "Status", st_received: "Received", st_in_progress: "In progress", st_ready: "Ready",
  st_collected: "Collected", st_cancelled: "Cancelled", billCollect: "Bill & hand over", ticket: "Repair ticket", noJobs: "No repair jobs.",
  estimate: "Estimate", repairLabour: "Repair labour", openJobs: "Open jobs",
  // receipts
  noReceipts: "No receipts to show.", staffReceiptsHint: "You see the receipts you made in the last 3 days.", voidSale: "Cancel sale",
  voided: "Cancelled", seller: "Seller", date: "Date",
  // owner
  today: "Today", thisMonth: "This month", revenue: "Sales", profit: "Profit", cost: "Cost", stockValue: "Stock value at cost",
  credit: "Customer credit", last30: "Last 30 days", topProducts: "Best sellers", byDay: "By day", byProduct: "By product",
  bySeller: "By employee", from: "From", to: "To", exportCsv: "Export CSV", importCsv: "Import CSV", importDone: "products added", importSkipped: "already existed", receiptsN: "receipts", marginPct: "margin",
  newOrder: "New order", po: "Order", ordered: "Ordered", draft: "Draft", receive: "Mark received", fillLow: "Fill from low stock",
  orderTotal: "Order total", noOrders: "No purchase orders yet.", addSupplier: "Add supplier", city: "City", noSuppliers: "No suppliers yet.",
  receivedOk: "Stock and cost prices updated", planner: "Book order planner", share: "Students buying from us (%)", grade: "Class",
  students: "Students", books: "Books", expected: "Expected", inStock: "In stock", toOrder: "To order", createOrders: "Create purchase orders",
  addSchool: "Add school", addGrade: "Add class", linkBook: "Link a book", plannerEmpty: "Open a school, add its classes with student numbers and link each class's books.",
  addEmployee: "Add employee", role: "Role", role_staff: "Employee", role_owner: "Owner", role_pending: "No access", employeeHint:
  "Employees log in to the Shop app with this username and password. Write them down and give them to the employee.",
  accountCreated: "Account created", pwdShort: "Password must be at least 8 characters.", usernameRule: "Use letters, numbers, dots or dashes only.",
  shopName: "Shop name", address: "Address", footer: "Receipt footer", rate: "Exchange rate (LL per $1)", bookShare: "Book share (%)",
  you: "you", catalogue: "Catalogue", private: "Owner only",
  // categories
  cat_stationery: "Stationery", cat_books: "Books", cat_toys: "Toys", cat_bikes: "Bicycles", cat_bike_parts: "Bike parts",
  cat_bags: "Backpacks", cat_uniforms: "Uniforms", cat_services: "Services", cat_other: "Other",
},
fr: {
  staffApp: "Magasin", ownerApp: "Propriétaire",
  home: "Accueil", sell: "Vente", stock: "Stock", repairs: "Réparations", customers: "Clients", receipts: "Tickets",
  more: "Plus", reports: "Rapports", orders: "Commandes", suppliers: "Fournisseurs", schools: "Écoles", team: "Équipe", settings: "Réglages",
  logout: "Déconnexion", loading: "Chargement…", retry: "Réessayer", save: "Enregistrer", cancel: "Annuler", close: "Fermer", delete: "Supprimer",
  confirmDelete: "Touchez encore pour confirmer", add: "Ajouter", edit: "Modifier", search: "Chercher", none: "Aucun", all: "Tout", yes: "Oui", no: "Non",
  saved: "Enregistré", errSave: "Échec de l'enregistrement. Vérifiez la connexion internet.", errLoad: "Chargement impossible. Vérifiez la connexion internet.",
  offline: "Pas de connexion internet. Les ventes ne peuvent pas être enregistrées pour l'instant.",
  login: "Se connecter", username: "Identifiant ou email", password: "Mot de passe", wrongLogin: "Identifiant ou mot de passe incorrect.",
  noAccess: "Ce compte attend qu'un propriétaire lui donne accès.", ownerOnly: "Cette application est réservée aux propriétaires. Utilisez l'application Magasin.",
  createOwner: "Première fois ? Créer le compte propriétaire", email: "Email", fullName: "Nom complet", createAccount: "Créer le compte",
  haveAccount: "J'ai déjà un compte", ownerCreated: "Compte propriétaire créé.",
  ll: "LL",
  scanSearch: "Scanner ou chercher par nom ou code-barres", scan: "Scanner", customItem: "Article libre", customHint: "Photocopies, impression, main-d'œuvre…",
  cartEmpty: "Scannez un code-barres ou cherchez pour ajouter des articles.", subtotal: "Sous-total", discount: "Remise ($)", total: "Total",
  paidUsd: "Payé en $", paidLbp: "Payé en LL", change: "Monnaie à rendre", due: "Reste à payer", customer: "Client",
  chooseCustomer: "Ajouter un client", walkIn: "Client de passage", onAccount: "Mettre le reste sur le compte du client",
  completeSale: "Valider la vente", saleDone: "Vente enregistrée", newSale: "Nouvelle vente", downloadPdf: "Télécharger le PDF", share: "Partager",
  receiptNo: "Ticket", price: "Prix", qty: "Qté", unitPrice: "Prix unitaire ($)", fromRepair: "Depuis la réparation",
  notFoundCreate: "Aucun produit avec ce code. Le créer ?", outOfStockWarn: "Le stock est déjà à 0 pour", owes: "doit",
  addProduct: "Ajouter un produit", lowStock: "Stock bas", outOfStock: "Rupture", name: "Nom", barcode: "Code-barres", category: "Catégorie",
  kind: "Type", kindItem: "Article en stock", kindService: "Service (sans stock)", priceUsd: "Prix de vente ($)", quantity: "Quantité en stock",
  minQty: "Alerte à partir de", costUsd: "Prix d'achat ($)", supplier: "Fournisseur", margin: "Marge", active: "Actif",
  priceLocked: "Seuls les propriétaires peuvent changer le prix.", adjust: "Modifier le stock", received: "Reçu", removed: "Abîmé / perdu", counted: "Inventaire",
  apply: "Appliquer", history: "Historique du stock", items: "articles", noProducts: "Aucun produit. Ajoutez-les un par un ou scannez leurs codes-barres.",
  duplicateBarcode: "Un autre produit a déjà ce code-barres.", archive: "Masquer le produit", hidden: "Masqué",
  addCustomer: "Ajouter un client", phone: "Téléphone", notes: "Notes", balance: "Reste dû", takePayment: "Encaisser un paiement",
  amountUsd: "Montant ($)", paymentSaved: "Paiement enregistré", purchases: "Achats", noCustomers: "Aucun client.",
  newJob: "Nouvelle réparation", job: "Réparation", bike: "Vélo", bikeHint: "Marque, couleur, taille", problem: "Problème", labour: "Main-d'œuvre ($)",
  parts: "Pièces utilisées", addPart: "Ajouter une pièce", status: "Statut", st_received: "Reçu", st_in_progress: "En cours", st_ready: "Prêt",
  st_collected: "Récupéré", st_cancelled: "Annulé", billCollect: "Facturer et remettre", ticket: "Bon de réparation", noJobs: "Aucune réparation.",
  estimate: "Estimation", repairLabour: "Main-d'œuvre réparation", openJobs: "Réparations en cours",
  noReceipts: "Aucun ticket.", staffReceiptsHint: "Vous voyez vos tickets des 3 derniers jours.", voidSale: "Annuler la vente",
  voided: "Annulée", seller: "Vendeur", date: "Date",
  today: "Aujourd'hui", thisMonth: "Ce mois", revenue: "Ventes", profit: "Bénéfice", cost: "Coût", stockValue: "Valeur du stock (coût)",
  credit: "Crédit clients", last30: "30 derniers jours", topProducts: "Meilleures ventes", byDay: "Par jour", byProduct: "Par produit",
  bySeller: "Par employé", from: "Du", to: "Au", exportCsv: "Exporter CSV", importCsv: "Importer CSV", importDone: "produits ajoutés", importSkipped: "existaient déjà", receiptsN: "tickets", marginPct: "marge",
  newOrder: "Nouvelle commande", po: "Commande", ordered: "Commandée", draft: "Brouillon", receive: "Marquer reçue", fillLow: "Remplir depuis le stock bas",
  orderTotal: "Total commande", noOrders: "Aucune commande.", addSupplier: "Ajouter un fournisseur", city: "Ville", noSuppliers: "Aucun fournisseur.",
  receivedOk: "Stock et prix d'achat mis à jour", planner: "Planification des livres", share: "Élèves qui achètent chez nous (%)", grade: "Classe",
  students: "Élèves", books: "Livres", expected: "Prévu", inStock: "En stock", toOrder: "À commander", createOrders: "Créer les commandes",
  addSchool: "Ajouter une école", addGrade: "Ajouter une classe", linkBook: "Lier un livre", plannerEmpty: "Ouvrez une école, ajoutez ses classes avec le nombre d'élèves et liez les livres de chaque classe.",
  addEmployee: "Ajouter un employé", role: "Rôle", role_staff: "Employé", role_owner: "Propriétaire", role_pending: "Sans accès",
  employeeHint: "Les employés se connectent à l'application Magasin avec cet identifiant et ce mot de passe. Notez-les et donnez-les à l'employé.",
  accountCreated: "Compte créé", pwdShort: "Le mot de passe doit faire au moins 8 caractères.", usernameRule: "Lettres, chiffres, points ou tirets seulement.",
  shopName: "Nom du magasin", address: "Adresse", footer: "Bas du ticket", rate: "Taux (LL pour 1 $)", bookShare: "Part livres (%)",
  you: "vous", catalogue: "Catalogue", private: "Propriétaires seulement",
  cat_stationery: "Papeterie", cat_books: "Livres", cat_toys: "Jouets", cat_bikes: "Vélos", cat_bike_parts: "Pièces vélo",
  cat_bags: "Cartables", cat_uniforms: "Uniformes", cat_services: "Services", cat_other: "Autre",
},
ar: {
  staffApp: "المحل", ownerApp: "المالك",
  home: "الرئيسية", sell: "بيع", stock: "المخزون", repairs: "التصليح", customers: "الزبائن", receipts: "الفواتير",
  more: "المزيد", reports: "التقارير", orders: "الطلبيات", suppliers: "الموردون", schools: "المدارس", team: "الفريق", settings: "الإعدادات",
  logout: "تسجيل الخروج", loading: "جارٍ التحميل…", retry: "حاول مجدداً", save: "حفظ", cancel: "إلغاء", close: "إغلاق", delete: "حذف",
  confirmDelete: "اضغط مجدداً للتأكيد", add: "إضافة", edit: "تعديل", search: "بحث", none: "بلا", all: "الكل", yes: "نعم", no: "لا",
  saved: "تم الحفظ", errSave: "تعذّر الحفظ. تحقق من الإنترنت وحاول مجدداً.", errLoad: "تعذّر التحميل. تحقق من الإنترنت.",
  offline: "لا يوجد إنترنت. لا يمكن حفظ المبيعات حتى يعود الاتصال.",
  login: "دخول", username: "اسم المستخدم أو البريد", password: "كلمة المرور", wrongLogin: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  noAccess: "هذا الحساب بانتظار موافقة المالك.", ownerOnly: "هذا التطبيق للمالكين فقط. استخدم تطبيق المحل.",
  createOwner: "أول مرة؟ أنشئ حساب المالك", email: "البريد الإلكتروني", fullName: "الاسم الكامل", createAccount: "إنشاء الحساب",
  haveAccount: "لدي حساب", ownerCreated: "تم إنشاء حساب المالك.",
  ll: "ل.ل",
  scanSearch: "امسح أو ابحث بالاسم أو الباركود", scan: "مسح", customItem: "صنف حر", customHint: "تصوير، طباعة، أجرة تصليح…",
  cartEmpty: "امسح باركود أو ابحث لإضافة أصناف.", subtotal: "المجموع", discount: "حسم ($)", total: "الإجمالي",
  paidUsd: "المدفوع بالدولار", paidLbp: "المدفوع بالليرة", change: "الباقي للزبون", due: "المتبقي", customer: "الزبون",
  chooseCustomer: "إضافة زبون", walkIn: "زبون عابر", onAccount: "سجّل المبلغ غير المدفوع على حساب الزبون (دين)",
  completeSale: "إتمام البيع", saleDone: "تم حفظ البيع", newSale: "بيع جديد", downloadPdf: "تحميل PDF", share: "مشاركة",
  receiptNo: "فاتورة", price: "السعر", qty: "كمية", unitPrice: "سعر الوحدة ($)", fromRepair: "من التصليح",
  notFoundCreate: "لا يوجد صنف بهذا الباركود. إنشاؤه؟", outOfStockWarn: "المخزون صفر لـ", owes: "عليه",
  addProduct: "إضافة صنف", lowStock: "مخزون منخفض", outOfStock: "نفد", name: "الاسم", barcode: "الباركود", category: "الفئة",
  kind: "النوع", kindItem: "صنف في المخزون", kindService: "خدمة (بلا مخزون)", priceUsd: "سعر البيع ($)", quantity: "الكمية في المخزون",
  minQty: "تنبيه عند أو تحت", costUsd: "سعر الكلفة ($)", supplier: "المورّد", margin: "الربح", active: "فعّال",
  priceLocked: "تغيير السعر للمالكين فقط.", adjust: "تعديل المخزون", received: "استلام", removed: "تالف / مفقود", counted: "جرد",
  apply: "تطبيق", history: "سجل المخزون", items: "أصناف", noProducts: "لا أصناف بعد. أضفها واحداً واحداً أو امسح الباركود.",
  duplicateBarcode: "يوجد صنف آخر بهذا الباركود.", archive: "إخفاء الصنف", hidden: "مخفي",
  addCustomer: "إضافة زبون", phone: "الهاتف", notes: "ملاحظات", balance: "الدين", takePayment: "تسجيل دفعة",
  amountUsd: "المبلغ ($)", paymentSaved: "تم تسجيل الدفعة", purchases: "المشتريات", noCustomers: "لا زبائن بعد.",
  newJob: "تصليح جديد", job: "تصليح", bike: "الدراجة", bikeHint: "الماركة، اللون، المقاس", problem: "العطل", labour: "أجرة اليد ($)",
  parts: "القطع المستعملة", addPart: "إضافة قطعة", status: "الحالة", st_received: "مستلمة", st_in_progress: "قيد التصليح", st_ready: "جاهزة",
  st_collected: "سُلّمت", st_cancelled: "ملغاة", billCollect: "الفوترة والتسليم", ticket: "وصل تصليح", noJobs: "لا تصليحات.",
  estimate: "تقدير", repairLabour: "أجرة تصليح", openJobs: "تصليحات مفتوحة",
  noReceipts: "لا فواتير.", staffReceiptsHint: "تظهر فواتيرك لآخر ٣ أيام.", voidSale: "إلغاء البيع",
  voided: "ملغاة", seller: "البائع", date: "التاريخ",
  today: "اليوم", thisMonth: "هذا الشهر", revenue: "المبيعات", profit: "الربح", cost: "الكلفة", stockValue: "قيمة المخزون بالكلفة",
  credit: "ديون الزبائن", last30: "آخر ٣٠ يوماً", topProducts: "الأكثر مبيعاً", byDay: "حسب اليوم", byProduct: "حسب الصنف",
  bySeller: "حسب الموظف", from: "من", to: "إلى", exportCsv: "تصدير CSV", importCsv: "استيراد CSV", importDone: "صنف أُضيف", importSkipped: "موجود مسبقاً", receiptsN: "فواتير", marginPct: "ربح",
  newOrder: "طلبية جديدة", po: "طلبية", ordered: "مطلوبة", draft: "مسودة", receive: "تأكيد الاستلام", fillLow: "تعبئة من المخزون المنخفض",
  orderTotal: "مجموع الطلبية", noOrders: "لا طلبيات بعد.", addSupplier: "إضافة مورّد", city: "المدينة", noSuppliers: "لا موردين بعد.",
  receivedOk: "تم تحديث المخزون وأسعار الكلفة", planner: "تخطيط طلبيات الكتب", share: "نسبة الطلاب الذين يشترون منا (٪)", grade: "الصف",
  students: "الطلاب", books: "الكتب", expected: "المتوقع", inStock: "في المخزون", toOrder: "للطلب", createOrders: "إنشاء الطلبيات",
  addSchool: "إضافة مدرسة", addGrade: "إضافة صف", linkBook: "ربط كتاب", plannerEmpty: "افتح مدرسة، أضف صفوفها مع عدد الطلاب، واربط كتب كل صف.",
  addEmployee: "إضافة موظف", role: "الصلاحية", role_staff: "موظف", role_owner: "مالك", role_pending: "بلا صلاحية",
  employeeHint: "يدخل الموظف إلى تطبيق المحل بهذا الاسم وكلمة المرور. دوّنهما وأعطهما للموظف.",
  accountCreated: "تم إنشاء الحساب", pwdShort: "كلمة المرور ٨ أحرف على الأقل.", usernameRule: "أحرف لاتينية وأرقام ونقاط أو شرطات فقط.",
  shopName: "اسم المحل", address: "العنوان", footer: "أسفل الفاتورة", rate: "سعر الصرف (ليرة لكل ١$)", bookShare: "نسبة الكتب (٪)",
  you: "أنت", catalogue: "الكتالوج", private: "للمالك فقط",
  cat_stationery: "قرطاسية", cat_books: "كتب", cat_toys: "ألعاب", cat_bikes: "دراجات", cat_bike_parts: "قطع دراجات",
  cat_bags: "حقائب", cat_uniforms: "زي مدرسي", cat_services: "خدمات", cat_other: "أخرى",
}};

export const CATS = ["stationery","books","toys","bikes","bike_parts","bags","uniforms","services","other"];

let lang = (() => {
  try { const v = localStorage.getItem("ls-lang"); if (v && D[v]) return v; } catch (e) {}
  const n = (navigator.language || "ar").slice(0, 2);
  return D[n] ? n : "ar";
})();

export const getLang = () => lang;
export function setLang(l) {
  if (!D[l]) return;
  lang = l;
  try { localStorage.setItem("ls-lang", l); } catch (e) {}
  applyDir();
}
export function applyDir() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}
export const t = (k) => (D[lang] && D[lang][k]) ?? D.en[k] ?? k;
export const catName = (c) => t("cat_" + (CATS.includes(c) ? c : "other"));
export const locale = () => (lang === "ar" ? "ar-LB-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB");
