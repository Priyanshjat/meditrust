import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Pill,
  ShieldCheck,
  Star,
  ArrowRight,
  ChevronDown,
  Check,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import useNavigateById from '../../hooks/useNavigateById';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import productServices from '../../services/medicalService';
import medicalService from '../../services/medicalService';
import Loader from '../../components/common/Loader';

const MOCK_CATEGORIES = [
  'All Products',
  'Prescription Drugs',
  'Pain Relief & OTC',
  'Vitamins & Nutrition',
  'Diabetes Management',
  'First Aid & Surgical',
  'Cardiac Care',
  'Skin & Dermatology',
];

// --- Fuzzy matching helpers: prescription OCR text is noisy, so compare
// normalised names/tokens instead of exact strings. ---
const normalize = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const IGNORED_WORDS = new Set([
  'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'suspension',
  'injection', 'mg', 'ml', 'gm',
]);

const nameTokens = (value = '') =>
  normalize(value).split(' ').filter((word) => word.length > 2 && !IGNORED_WORDS.has(word));

const namesMatch = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  return nameTokens(a).some((token) => nb.includes(token));
};

const isExpired = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !Number.isNaN(date.getTime()) && date < new Date();
};

const RX_STATUS = {
  available: { label: 'In stock', variant: 'success' },
  unavailable: { label: 'Out of stock', variant: 'warning' },
  'not-listed': { label: 'Not in catalogue', variant: 'neutral' },
};

export default function ProductListingPage() {
  const onNavigate = useNavigateById();
  const location = useLocation();

  // Prescription context passed from the AI scanner page (if any)
  const rx = location.state?.prescription || null;
  const focusMedicine = location.state?.focusMedicine || '';

  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [search, setSearch] = useState('');
  const [rxOnly, setRxOnly] = useState(Boolean(focusMedicine));

  const toggleRxOnly = () => {
    if (rxOnly) {
      // Turning the prescription filter off should reveal the full catalogue,
      // so drop any leftover search term too.
      setRxOnly(false);
      setSearch('');
    } else {
      setRxOnly(true);
    }
  };

  const { data, isLoading, isSuccess, isError, error } = useQuery({ queryKey: ['items'], queryFn: medicalService.fetchData })



  if (isLoading) {
    return (
      <Loader />
    )
  }


  if (isError) {
    return (
      <div className="h-screen">
        <h1 className="text-center">{error.message || "Something Went Wrong!!"}</h1>
      </div>
    )
  }

  // Match each prescribed medicine against the live pharmacy inventory.
  // When the AI availability check ran, prefer its matched product name.
  const rxMatches = (rx?.medicines || []).map((med, index) => {
    const aiEntry =
      rx.availability?.[index] ||
      rx.availability?.find((entry) => namesMatch(entry.prescribed_name, med.name));

    let product = aiEntry?.matched_product_name
      ? data.medicines.find((p) => namesMatch(p.name, aiEntry.matched_product_name))
      : null;

    if (!product) {
      product = data.medicines.find((p) => namesMatch(p.name, med.name)) || null;
    }

    const inStock = Boolean(
      product && product.stock > 0 && product.isActive !== false && !isExpired(product.expiresOn)
    );
    const available = aiEntry ? Boolean(aiEntry.available) : inStock;
    const hasAnyMatch = Boolean(product || aiEntry?.matched_product_name);
    const status = available ? 'available' : hasAnyMatch ? 'unavailable' : 'not-listed';

    return {
      med,
      product,
      status,
      price: product?.price ?? aiEntry?.price ?? null,
    };
  });

  const rxProductIds = new Set(rxMatches.map((match) => match.product?._id).filter(Boolean));

  const visibleProducts = data.medicines.filter((prod) => {
    const term = normalize(search);
    const matchesSearch =
      !term ||
      normalize(prod.name).includes(term) ||
      normalize(prod.description).includes(term);
    const matchesRx = !rxOnly || rxProductIds.has(prod._id);
    return matchesSearch && matchesRx;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-lg">
        <div className="max-w-2xl space-y-3 relative z-10">
          <Badge variant="success" size="sm" className="bg-emerald-400/20 text-emerald-300 border-emerald-400/30">
            Express Medicine Dispatch
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            MediTrust Online Pharmacy
          </h1>
          <p className="text-teal-100 text-sm sm:text-base leading-relaxed">
            Order authentic prescription and over-the-counter medications directly to your doorstep. Free delivery on orders above $35.
          </p>
        </div>
        <div className="hidden lg:block absolute right-10 top-1/2 -translate-y-1/2 opacity-20">
          <Pill className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Prescription context banner */}
      {rx && rxMatches.length > 0 && (
        <Card className="p-5 border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50/60 to-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Medicines from your prescription
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {rx.id ? `RX-${String(rx.id).slice(-6).toUpperCase()} • ` : ''}
                  {rxMatches.filter((m) => m.status === 'available').length} of {rxMatches.length} matched
                  medicines are available in stock
                </p>
              </div>
            </div>

            <Button
              variant={rxOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={toggleRxOnly}
            >
              {rxOnly ? 'Show all medicines' : 'Show only my medicines'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {rxMatches.map((match, index) => {
              const meta = RX_STATUS[match.status];
              const isActive = normalize(search) === normalize(match.med.name);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (match.status === 'not-listed') return;
                    // Search by the catalogue product name when we have a
                    // match; fall back to the prescribed name otherwise.
                    setSearch(match.product?.name || match.med.name || '');
                    setRxOnly(true);
                  }}
                  title={match.product ? `Matched product: ${match.product.name}` : 'No matching product in the catalogue'}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                    match.status === 'available'
                      ? 'border-teal-200 bg-white text-teal-900 hover:border-teal-400'
                      : match.status === 'unavailable'
                      ? 'border-amber-200 bg-white text-amber-900 hover:border-amber-400'
                      : 'border-slate-200 bg-white text-slate-700 cursor-default'
                  } ${isActive ? 'ring-2 ring-teal-400' : ''}`}
                >
                  {match.status === 'available' ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="font-semibold">{match.med.name || 'Unknown medicine'}</span>
                  <Badge variant={meta.variant} size="sm">
                    {meta.label}
                    {match.status === 'available' && match.price != null
                      ? ` • ₹${Number(match.price).toFixed(2)}`
                      : ''}
                  </Badge>
                </button>
              );
            })}
          </div>

          {rxMatches.some((m) => m.status === 'not-listed') && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Some prescribed medicines aren't in our current catalogue. You can search for alternatives above
              or contact support with your prescription ID.
            </p>
          )}
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Search input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine brand or generic salt..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Sort by:</span>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none">
              <option>Popularity</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Highest Rated</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('ai-prescription')}
            icon={Sparkles}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            Upload Prescription
          </Button>
        </div>
      </div>

      {/* Category Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {MOCK_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              type="button"
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${isActive
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Main Grid of Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Showing <span className="text-slate-900 font-bold">{visibleProducts.length}</span> Verified Medicines
            {rxOnly && <span className="text-teal-700"> (your prescription)</span>}
          </p>
          <span className="text-xs text-teal-700 font-semibold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-teal-600 text-teal-600" />
            Same-day dispatch available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {visibleProducts.length === 0 && (
            <Card className="col-span-full p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                No medicines match your current filters.
              </p>
              <p className="text-xs text-slate-500">
                Try clearing the search or showing all medicines.
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setRxOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </Card>
          )}

          {visibleProducts.map((prod) => {
            const rxHit = rxMatches.find((match) => match.product?._id === prod._id);
            return (
            <Card
              key={prod._id}
              hoverEffect
              className={`flex flex-col justify-between p-4 h-full group ${
                rxHit ? 'ring-2 ring-teal-400 border-teal-300' : ''
              }`}
            >
              <div>
                {/* Product Image Area */}
                <div
                  onClick={() => onNavigate('product-detail')}
                  className="relative rounded-xl overflow-hidden aspect-square mb-3 bg-slate-50 flex items-center justify-center p-4 cursor-pointer"
                >
                  {rxHit && (
                    <Badge variant="success" size="sm" dot className="absolute top-2 left-2 z-10 shadow-xs">
                      Your prescription
                    </Badge>
                  )}
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <h3
                    onClick={() => onNavigate('product-detail')}
                    className="font-bold text-slate-900 text-sm hover:text-teal-700 transition-colors cursor-pointer line-clamp-1"
                  >
                    {prod.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                </div>
              </div>

              {/* Direct Order Now Row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-slate-900">₹{prod.price.toFixed(2)}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('product-detail')}
                  className="shadow-xs"
                >
                  Order Now
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      </div>

      {/* Pagination / Load More UI */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Showing {visibleProducts.length} of {data.medicines.length} medicines
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <span className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold">1</span>
          <span className="px-3 py-1 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer">2</span>
          <span className="px-3 py-1 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer">3</span>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>

    </div>
  );
}
