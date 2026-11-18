import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Sparkles,
  Upload,
  FileText,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pill,
  ShieldCheck,
  RotateCw,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import useNavigateById from '../../hooks/useNavigateById';
import aiService from '../../services/aiService';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const display = (value) => (value && String(value).trim() ? value : 'Not clearly readable');

export default function PrescriptionExplainerPage() {
  const onNavigate = useNavigateById();
  const { user } = useSelector((state) => state.auth);

  const fileInputRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [prescription, setPrescription] = useState(null);
  const [error, setError] = useState('');

  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const reset = () => {
    setPrescription(null);
    setAvailability(null);
    setError('');
    setAvailabilityError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, WebP or PDF file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 20MB.');
      return;
    }
    if (!user?.token) {
      setError('You must be logged in to scan a prescription.');
      return;
    }

    setError('');
    setAvailability(null);
    setAvailabilityError('');
    setPrescription(null);
    setIsScanning(true);

    try {
      const data = await aiService.explainPrescription({ file, token: user.token });
      setPrescription(data);
    } catch (err) {
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          'Something went wrong while scanning the prescription. Please try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    uploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    uploadFile(file);
  };

  const checkAvailability = async () => {
    if (!prescription?._id) return;

    setCheckingAvailability(true);
    setAvailabilityError('');

    try {
      const data = await aiService.findMedicines({
        prescriptionId: prescription._id,
        token: user.token,
      });
      setAvailability(data);
    } catch (err) {
      setAvailabilityError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          'Could not check medicine availability right now. Please try again.'
      );
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Match an availability entry to a prescription medicine (by name first,
  // then by position, since the AI is asked to preserve order).
  const availabilityFor = (med, index) =>
    availability?.medicines?.find(
      (m) => m.prescribed_name && med.name &&
        m.prescribed_name.toLowerCase().trim() === med.name.toLowerCase().trim()
    ) || availability?.medicines?.[index];

  const medicines = prescription?.medicines || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <Badge variant="purple" size="sm">
          Vision OCR & Clinical Parser
        </Badge>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          AI Prescription Explainer
        </h1>
        <p className="text-sm text-slate-600">
          Upload any handwritten doctor's slip or clinic discharge summary. Our medical vision model deciphers medication schedules, food instructions, and safety precautions.
        </p>
      </div>

      {/* Upload Zone & Scan State */}
      <Card
        className={`p-8 border-dashed border-2 bg-indigo-50/20 text-center transition-all ${
          isDragging ? 'border-indigo-500 bg-indigo-50/60' : 'border-indigo-200 hover:border-indigo-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {isScanning ? (
          /* Animated Scanning State */
          <div className="py-10 space-y-4 max-w-md mx-auto animate-pulse">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Scan className="w-10 h-10 animate-spin" />
              </div>
              <div className="absolute inset-0 border-2 border-indigo-400 rounded-2xl animate-ping" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-indigo-950">
                Scanning Doctor's Handwriting...
              </h3>
              <p className="text-xs text-indigo-700/80">
                Running optical character recognition and matching against FDA pharmacopeia database...
              </p>
            </div>

            <div className="w-48 bg-indigo-200 rounded-full h-1.5 mx-auto overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full w-2/3 animate-pulse" />
            </div>
          </div>
        ) : (
          /* Dropzone */
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Drag & Drop Your Prescription Image or PDF
              </h3>
              <p className="text-xs text-slate-400">
                Supports JPG, PNG, PDF up to 20MB. Clear lighting produces best accuracy.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="ai"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                icon={Sparkles}
              >
                Upload & Scan New Slip
              </Button>
              {prescription && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={reset}
                  icon={RotateCw}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-left text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* Extracted Results Section */}
      {prescription && !isScanning && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Metadata Strip */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {prescription.image && (
                <a
                  href={prescription.image}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:block shrink-0"
                  title="Open uploaded prescription"
                >
                  <img
                    src={prescription.image}
                    alt="Uploaded prescription"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                  />
                </a>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    RX-{String(prescription._id).slice(-6).toUpperCase()}
                  </span>
                  <Badge variant="success" size="sm" dot>
                    Scan complete
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Prescribed by: {display(prescription.doctor_name)}
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: {display(prescription.patient_name)} • Date: {display(prescription.date)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('pharmacy')}
                icon={Pill}
              >
                Order All Medicines via Pharmacy
              </Button>
              <Button
                variant="ai"
                size="sm"
                onClick={checkAvailability}
                disabled={checkingAvailability || medicines.length === 0}
                icon={checkingAvailability ? Loader2 : Sparkles}
              >
                {checkingAvailability ? 'Checking availability...' : 'Check Pharmacy Availability'}
              </Button>
            </div>
          </div>

          {availabilityError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{availabilityError}</span>
            </div>
          )}

          {availability?.summary && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-xs text-teal-900">
              <span className="font-bold">
                {availability.summary.medicines_available}/{availability.summary.total_medicines_prescribed}
              </span>{' '}
              prescribed medicines are in stock at the MediTrust pharmacy.
              {availability.summary.tests_prescribed > 0 && (
                <> {availability.summary.tests_with_available_labs}/{availability.summary.tests_prescribed} lab tests have a matching diagnostic center.</>
              )}
            </div>
          )}

          {/* Cards for each extracted medicine */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Extracted Medications & Dosage Schedule ({medicines.length})
            </h3>

            {medicines.length === 0 && (
              <Card className="p-6 border-slate-200 text-center text-xs text-slate-500">
                No medicines could be read from this prescription. Try uploading a clearer photo.
              </Card>
            )}

            {medicines.map((med, index) => {
              const match = availabilityFor(med, index);
              return (
                <Card key={index} className="p-6 border-slate-200 shadow-xs space-y-4">

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900">{display(med.name)}</h4>
                      </div>
                      <p className="text-xs text-slate-400 pl-7">
                        Dosage: {display(med.dosage)} • Frequency: {display(med.frequency)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {match?.available ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-teal-700">
                          <CheckCircle2 className="w-4 h-4" />
                          ${Number(match.price).toFixed(2)}
                        </span>
                      ) : match ? (
                        <span className="text-xs font-semibold text-slate-400">
                          {match.available ? '' : 'Not available'}
                        </span>
                      ) : null}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onNavigate('pharmacy')}
                      >
                        Order Now
                      </Button>
                    </div>
                  </div>

                  {/* Schedule Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">

                    {/* Duration & Frequency */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Schedule & Duration
                      </span>
                      <p className="text-xs font-medium text-slate-800 flex items-start gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        {display(med.frequency)}
                      </p>
                      <span className="text-xs text-slate-500 block pt-1">{display(med.duration)}</span>
                    </div>

                    {/* Notes / Instructions */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Administration Guideline
                      </span>
                      <p className="text-xs font-medium text-slate-800 flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        {display(med.notes)}
                      </p>
                      <p className="text-[11px] text-slate-500 pt-1">
                        Dosage: {display(med.dosage)}
                      </p>
                    </div>

                    {/* Availability / Safety */}
                    <div className={`p-3.5 rounded-xl border space-y-1 ${
                      match?.available
                        ? 'bg-teal-50/60 border-teal-200/70'
                        : 'bg-amber-50/60 border-amber-200/70'
                    }`}>
                      <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                        match?.available ? 'text-teal-800' : 'text-amber-800'
                      }`}>
                        Pharmacy Availability
                      </span>
                      {match ? (
                        <p className={`text-xs flex items-start gap-1.5 ${
                          match.available ? 'text-teal-900' : 'text-amber-900'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            {match.available
                              ? `${match.matched_product_name} — in stock (${match.stock} units)`
                              : match.reason || 'No matching product found'}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          Click "Check Pharmacy Availability" above to match these medicines with our inventory.
                        </p>
                      )}
                    </div>

                  </div>

                </Card>
              );
            })}
          </div>

          {/* Lab tests suggested by the availability check */}
          {availability?.tests?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Lab Tests & Diagnostic Centers
              </h3>
              {availability.tests.map((test, i) => (
                <Card key={i} className="p-5 border-slate-200 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">{test.prescribed_test}</h4>
                  {test.available_labs?.length ? (
                    <div className="space-y-2">
                      {test.available_labs.map((lab, j) => (
                        <div key={j} className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold">{lab.laboratoryName}</span>
                            <span className="text-slate-400"> • {lab.laboratoryAddress}</span>
                            {lab.availableDays?.length > 0 && (
                              <div className="text-slate-500 pt-0.5">Days: {lab.availableDays.join(', ')}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-teal-700">${Number(lab.consultationFee).toFixed(2)}</span>
                            <Button variant="outline" size="sm" onClick={() => onNavigate('lab')}>
                              Book Test
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No diagnostic center currently offers this test.</p>
                  )}
                </Card>
              ))}
            </div>
          )}

          {prescription.diagnosis_notes && (
            <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
              <span className="font-bold text-slate-700">Doctor's notes: </span>
              {prescription.diagnosis_notes}
            </div>
          )}

          <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-500 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            MediTrust AI extraction is an assistive readout. Always double-check dosage instructions with the packaging label and your pharmacist.
          </div>

        </div>
      )}

    </div>
  );
}
