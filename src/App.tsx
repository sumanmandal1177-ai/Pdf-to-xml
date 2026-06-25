import React, { useState, useMemo, useRef } from "react";
import { 
  FileText, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Settings, 
  HelpCircle, 
  FileCode, 
  BookOpen,
  X,
  Sparkles,
  AlertCircle,
  UploadCloud,
  FileSpreadsheet,
  File,
  CheckCircle2
} from "lucide-react";
import * as XLSX from "xlsx";

interface Transaction {
  id: string; // React local unique key
  date: string; // YYYY-MM-DD
  description: string;
  refNo: string;
  type: "credit" | "debit"; // credit = Money In (Receipt), debit = Money Out (Payment)
  amount: number;
}

interface ParseResponse {
  guessedBankName: string;
  transactions: {
    date: string;
    description: string;
    refNo: string;
    type: "credit" | "debit";
    amount: number;
  }[];
}

const INITIAL_STATEMENT_SAMPLE = `HDFC BANK LIMITED
STATEMENT OF ACCOUNT FOR THE PERIOD OF 01-Jun-2026 TO 15-Jun-2026
ACCOUNT NUMBER: 50100234598762

Date        Narration                             Chq/Ref No.      Value Date  Withdrawal(Dr)  Deposit(Cr)    Closing Balance
02-Jun-26   UPI-SURESH KUMAR-PAY-98402123@okaxis 361234901827    02-Jun-26                     1,500.00       24,500.00
04-Jun-26   NEFT-VODAFONE IDEA MONTHLY BILL      NEFT872164392   04-Jun-26    799.00                         23,701.00
07-Jun-26   CHQ DEP-M/S SHARMA ENTERPRISES       502391          07-Jun-26                     12,500.00      36,201.00
10-Jun-26   ATM WDL-NEW DELHI MAIN ROAD          ATM718293       10-Jun-26    5,000.00                       31,201.00
12-Jun-26   IMPS-RELIANCE SMART-REF-61234590123  61234590123     12-Jun-26    1,850.00                       29,351.00
14-Jun-26   INTEREST CREDITED                    INT-JUN-26      14-Jun-26                     342.00         29,693.00`;

export default function App() {
  const [activeInputTab, setActiveInputTab] = useState<"upload" | "paste">("upload");
  const [rawText, setRawText] = useState("");
  const [bankLedgerName, setBankLedgerName] = useState("HDFC Bank Account");
  const [suspenseLedgerName, setSuspenseLedgerName] = useState("Suspense Ledger");
  const [partyLedgerOption, setPartyLedgerOption] = useState<"suspense" | "bank">("suspense");
  const [xmlWrapper, setXmlWrapper] = useState<"envelope-only" | "tally-import">("envelope-only");
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [excelSuccessNotice, setExcelSuccessNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transactions list
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Parse raw text statement
  const handleParseStatement = async () => {
    if (!rawText.trim()) {
      setError("Please paste bank statement rows or text to analyze first.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/parse-statement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ statementText: rawText }),
      });

      const resText = await res.text();
      if (!res.ok) {
        let errMsg = `Server Error (HTTP ${res.status})`;
        try {
          const errObj = JSON.parse(resText);
          errMsg = errObj.error || errMsg;
        } catch (e) {
          if (resText.trim()) {
            errMsg += `: ${resText.slice(0, 150)}`;
          } else {
            errMsg += ": Empty response from server.";
          }
        }
        throw new Error(errMsg);
      }

      let data: ParseResponse;
      try {
        data = JSON.parse(resText);
      } catch (err) {
        throw new Error(`Failed to parse response JSON: ${resText.slice(0, 150)}`);
      }
      
      if (data.guessedBankName) {
        setBankLedgerName(data.guessedBankName);
      }

      if (data.transactions && Array.isArray(data.transactions)) {
        const formattedList: Transaction[] = data.transactions.map((t, idx) => ({
          id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          date: t.date || new Date().toISOString().split("T")[0],
          description: t.description || "Bank Transaction",
          refNo: t.refNo || "AUTO",
          type: t.type === "credit" ? "credit" : "debit",
          amount: Math.abs(Number(t.amount)) || 0
        }));
        setTransactions(formattedList);
      } else {
        throw new Error("No transactions found in the parsed output.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while interacting with the server.");
    } finally {
      setLoading(false);
    }
  };

  // Convert on-demand (either PDF or Raw Text)
  const handleConvertAction = async () => {
    setError(null);
    setExcelSuccessNotice(null);

    if (activeInputTab === "upload" && uploadedFile) {
      const extension = uploadedFile.name.split(".").pop()?.toLowerCase();
      
      if (extension === "pdf") {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Data = e.target?.result as string;
            
            const res = await fetch("/api/parse-pdf", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ base64Data }),
            });

            const resText = await res.text();
            if (!res.ok) {
              let errMsg = `Server Error (HTTP ${res.status})`;
              try {
                const errObj = JSON.parse(resText);
                errMsg = errObj.error || errMsg;
              } catch (e) {
                if (resText.trim()) {
                  errMsg += `: ${resText.slice(0, 150)}`;
                } else {
                  errMsg += ": Empty response from server.";
                }
              }
              throw new Error(errMsg);
            }

            let data: ParseResponse;
            try {
              data = JSON.parse(resText);
            } catch (err) {
              throw new Error(`Failed to parse response JSON: ${resText.slice(0, 150)}`);
            }

            if (data.guessedBankName) {
              setBankLedgerName(data.guessedBankName);
            }

            if (data.transactions && Array.isArray(data.transactions)) {
              const formattedList: Transaction[] = data.transactions.map((t, idx) => ({
                id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
                date: t.date || new Date().toISOString().split("T")[0],
                description: t.description || "Bank Transaction",
                refNo: t.refNo || "AUTO",
                type: t.type === "credit" ? "credit" : "debit",
                amount: Math.abs(Number(t.amount)) || 0
              }));
              setTransactions(formattedList);
            } else {
              throw new Error("No transactions found in the PDF statement.");
            }
          } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred while parsing the PDF.");
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(uploadedFile);
      } else {
        // Fallback or alert
        setError("Please review the extracted Excel text in the 'Paste Raw Text' tab or upload a valid PDF.");
      }
    } else {
      await handleParseStatement();
    }
  };

  // Handle local file parsing (drag & drop or click)
  const handleFileChange = (file: File) => {
    setError(null);
    setExcelSuccessNotice(null);
    setUploadedFile(file);

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls" || extension === "csv") {
      // Process Excel / CSV inside the browser using SheetJS (xlsx)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          let extractedText = "";
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              extractedText += `--- Excel Sheet: ${sheetName} ---\n${csv}\n\n`;
            }
          });
          
          if (!extractedText.trim()) {
            throw new Error("The Excel/CSV sheet seems to have no readable text rows.");
          }
          
          setRawText(extractedText);
          setExcelSuccessNotice(`Successfully parsed "${file.name}" into readable table rows. We've switched you to the "Paste Raw Text" tab to review or edit before sending to Gemini!`);
          setActiveInputTab("paste");
        } catch (err: any) {
          setError("Failed to process Excel/CSV: " + err.message);
          setUploadedFile(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === "pdf") {
      // We will read it as base64 on-demand when "Convert" is clicked
    } else {
      setError("Unsupported file format. Please upload a PDF, Excel sheet (.xlsx, .xls), or CSV file.");
      setUploadedFile(null);
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const loadSample = () => {
    setExcelSuccessNotice(null);
    setRawText(INITIAL_STATEMENT_SAMPLE);
    setActiveInputTab("paste");
    setError(null);
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setExcelSuccessNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Add a new empty transaction
  const handleAddTransaction = () => {
    const newTx: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      description: "New transaction details",
      refNo: "AUTO",
      type: "credit",
      amount: 0
    };
    setTransactions([newTx, ...transactions]);
  };

  // Update a transaction field
  const handleUpdateField = (id: string, field: keyof Transaction, value: any) => {
    setTransactions(
      transactions.map((t) => {
        if (t.id === id) {
          if (field === "amount") {
            const num = parseFloat(value);
            return { ...t, [field]: isNaN(num) ? 0 : Math.abs(num) };
          }
          return { ...t, [field]: value };
        }
        return t;
      })
    );
  };

  // Delete transaction
  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  // Compute Tally XML based on rules
  const xmlOutput = useMemo(() => {
    const vouchersXml = transactions.map((t) => {
      // 1. Voucher Type
      const vchType = t.type === "credit" ? "Receipt" : "Payment";
      
      // 2. Date format 'YYYYMMDD'
      const formattedDate = t.date.replace(/-/g, "");

      // 3. Voucher Ref Number
      const voucherNum = t.refNo && t.refNo.trim() !== "AUTO" ? t.refNo.trim() : "AUTO";

      // 4. Party Ledger Name
      const partyLedger = partyLedgerOption === "suspense" ? suspenseLedgerName : bankLedgerName;

      // 5. Dr/Cr Logic
      // Receipt (Money In): Bank Account is Debited (YES), Suspense Ledger is Credited (NO with negative amount)
      // Payment (Money Out): Bank Account is Credited (NO with negative amount), Suspense Ledger is Debited (YES)
      const isBankPositive = t.type === "credit" ? "YES" : "NO";
      const bankAmount = t.type === "credit" ? t.amount.toFixed(2) : `-${t.amount.toFixed(2)}`;

      const isSuspensePositive = t.type === "credit" ? "NO" : "YES";
      const suspenseAmount = t.type === "credit" ? `-${t.amount.toFixed(2)}` : t.amount.toFixed(2);

      return `    <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${formattedDate}</DATE>
        <VOUCHERNUMBER>${voucherNum}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
        <NARRATION>${t.description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</NARRATION>
        
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${bankLedgerName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isBankPositive}</ISDEEMEDPOSITIVE>
            <AMOUNT>${bankAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${suspenseLedgerName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isSuspensePositive}</ISDEEMEDPOSITIVE>
            <AMOUNT>${suspenseAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    }).join("\n");

    if (xmlWrapper === "envelope-only") {
      return `<ENVELOPE>\n${vouchersXml}\n</ENVELOPE>`;
    } else {
      return `<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
\n${vouchersXml}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
    }
  }, [transactions, bankLedgerName, suspenseLedgerName, partyLedgerOption, xmlWrapper]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(xmlOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download XML file
  const handleDownload = () => {
    const blob = new Blob([xmlOutput], { type: "text/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Tally_Vouchers_${new Date().toISOString().split("T")[0]}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format file sizes nicely
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Stats
  const stats = useMemo(() => {
    let credits = 0;
    let debits = 0;
    transactions.forEach(t => {
      if (t.type === "credit") credits += t.amount;
      else debits += t.amount;
    });
    return {
      total: transactions.length,
      credits,
      debits
    };
  }, [transactions]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-teal-100 antialiased">
      {/* Header Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 text-white p-2.5 rounded-xl shadow-inner flex items-center justify-center">
              <FileCode className="w-6 h-6" id="app_logo" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">
                Bank Statement to Tally XML
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Perfect accounting voucher formatter for Tally ERP 9 / TallyPrime
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition duration-150 cursor-pointer"
              id="help_btn"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Tally Rules Guide</span>
            </button>
            <div className="text-xs text-slate-400 font-mono px-2 py-1">
              v1.1 Multimodal
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Help Panel (Collapsible) */}
        {showHelp && (
          <div className="mb-8 bg-teal-50/70 border border-teal-200/80 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 animate-fadeIn" id="guide_panel">
            <div className="absolute right-4 top-4">
              <button 
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-full text-teal-600 hover:bg-teal-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-4">
              <div className="bg-white p-2.5 rounded-xl text-teal-600 h-fit shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-teal-900 text-lg mb-2">Tally Voucher Import Rules</h3>
                <div className="grid md:grid-cols-2 gap-6 text-sm text-teal-950/80 leading-relaxed">
                  <div>
                    <h4 className="font-semibold text-teal-900 mb-1">1. Voucher Detection</h4>
                    <p className="mb-3">Receipt is generated for deposits/credits, while Payment is selected for withdrawals/debits. This automatically adjusts <code className="font-mono bg-teal-100/50 px-1 py-0.5 rounded text-teal-900">VCHTYPE</code>.</p>
                    
                    <h4 className="font-semibold text-teal-900 mb-1">2. Date Standardization</h4>
                    <p>Dates are transformed to standard <code className="font-mono bg-teal-100/50 px-1 py-0.5 rounded text-teal-900">YYYYMMDD</code> without dividers, as Tally expects.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-teal-900 mb-1">3. Dr / Cr Logic for Tally XML</h4>
                    <p className="mb-3">
                      <strong>Receipt (Money In):</strong> Bank Ledger is Debited (<code className="font-mono bg-teal-100/50 px-1 text-xs">ISDEEMEDPOSITIVE=YES</code>) and Suspense Ledger is Credited (<code className="font-mono bg-teal-100/50 px-1 text-xs">ISDEEMEDPOSITIVE=NO</code> with negative amount).
                    </p>
                    <p>
                      <strong>Payment (Money Out):</strong> Bank Ledger is Credited (<code className="font-mono bg-teal-100/50 px-1 text-xs">ISDEEMEDPOSITIVE=NO</code> with negative amount) and Suspense Ledger is Debited (<code className="font-mono bg-teal-100/50 px-1 text-xs">ISDEEMEDPOSITIVE=YES</code>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          {/* LEFT SIDE: INPUT & EDIT CONTROLS */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            
            {/* Row 1: Configurations */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col gap-6" id="configs_section">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="w-4 h-4 text-teal-600" />
                <h2 className="font-display font-semibold text-slate-900">Ledger Configurations</h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Bank Ledger Name
                  </label>
                  <input
                    type="text"
                    value={bankLedgerName}
                    onChange={(e) => setBankLedgerName(e.target.value)}
                    placeholder="e.g. HDFC Bank Account"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-hidden transition duration-150"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">This matches your ledger name in Tally.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Opposite / Suspense Ledger
                  </label>
                  <input
                    type="text"
                    value={suspenseLedgerName}
                    onChange={(e) => setSuspenseLedgerName(e.target.value)}
                    placeholder="e.g. Suspense Ledger"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-hidden transition duration-150"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Unmapped transaction counterpart ledger.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    PARTYLEDGERNAME Value
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPartyLedgerOption("suspense")}
                      className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                        partyLedgerOption === "suspense"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Suspense Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartyLedgerOption("bank")}
                      className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                        partyLedgerOption === "bank"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Bank Ledger
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    XML Wrapper Format
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setXmlWrapper("envelope-only")}
                      className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                        xmlWrapper === "envelope-only"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Envelope Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setXmlWrapper("tally-import")}
                      className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                        xmlWrapper === "tally-import"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Import Package
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Row 2: File Upload / Text Input Segment */}
            <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col" id="input_section">
              {/* Tab headers */}
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => { setActiveInputTab("upload"); setError(null); }}
                  className={`flex-1 py-3 px-4 text-xs font-semibold border-b-2 flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeInputTab === "upload"
                      ? "border-teal-600 text-teal-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import PDF / Excel / CSV</span>
                </button>
                <button
                  onClick={() => { setActiveInputTab("paste"); setError(null); }}
                  className={`flex-1 py-3 px-4 text-xs font-semibold border-b-2 flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeInputTab === "paste"
                      ? "border-teal-600 text-teal-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Paste Raw Text / Rows</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 flex flex-col gap-5">
                {activeInputTab === "upload" ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Upload your bank statement files. We support <strong>PDF statements</strong> (directly read via Gemini Multimodal) and <strong>Excel/CSV spreadsheets</strong> (parsed inside the browser via SheetJS).
                    </p>

                    {/* Drag and Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileInput}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                        dragActive
                          ? "border-teal-500 bg-teal-50/30"
                          : uploadedFile
                          ? "border-emerald-300 bg-emerald-50/10"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/40"
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        accept=".pdf,.xlsx,.xls,.csv,.txt"
                        className="hidden"
                      />

                      {uploadedFile ? (
                        <div className="flex flex-col items-center gap-2.5">
                          {uploadedFile.name.endsWith(".pdf") ? (
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                              <File className="w-8 h-8" />
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                              <FileSpreadsheet className="w-8 h-8" />
                            </div>
                          )}

                          <div>
                            <p className="text-sm font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                              {uploadedFile.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatFileSize(uploadedFile.size)} • {uploadedFile.name.split(".").pop()?.toUpperCase()} Document
                            </p>
                          </div>

                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={clearUploadedFile}
                              className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 transition cursor-pointer"
                            >
                              Remove File
                            </button>
                            <button
                              onClick={triggerFileInput}
                              className="text-xs font-semibold text-slate-600 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                            >
                              Choose Another
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 bg-teal-50 text-teal-600 rounded-full shadow-xs">
                            <UploadCloud className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Drag and drop your file here, or <span className="text-teal-600 hover:underline">browse files</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Supports PDF, XLSX, XLS, or CSV files
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Or parse raw lines copied from internet banking screens, e-statement summaries, or emails.
                      </p>
                      <button
                        onClick={loadSample}
                        className="text-xs font-semibold text-teal-600 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 transition cursor-pointer shrink-0"
                      >
                        Load Sample Text
                      </button>
                    </div>

                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste text records here... e.g.&#10;02-Jun-26  UPI-SURESH KUMAR  361234901827  1,500.00 Cr&#10;04-Jun-26  VODAFONE BILL  NEFT872164392  799.00 Dr"
                      rows={8}
                      className="w-full bg-slate-50 font-mono text-xs text-slate-700 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl p-4 outline-hidden leading-relaxed resize-y"
                      id="statement_textarea"
                    />
                  </div>
                )}

                {/* Notices and Errors */}
                {excelSuccessNotice && (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl flex items-start gap-3 text-xs animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div>{excelSuccessNotice}</div>
                  </div>
                )}

                {error && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3.5 rounded-xl flex items-start gap-2.5 text-xs animate-fadeIn">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                {/* Action button */}
                <button
                  onClick={handleConvertAction}
                  disabled={
                    loading || 
                    (activeInputTab === "upload" && !uploadedFile) || 
                    (activeInputTab === "paste" && !rawText.trim())
                  }
                  className={`w-full py-3.5 px-4 rounded-xl font-display font-semibold text-sm text-white shadow-md flex items-center justify-center gap-2.5 transition duration-150 cursor-pointer ${
                    loading 
                      ? "bg-slate-400 cursor-not-allowed" 
                      : (activeInputTab === "upload" && !uploadedFile) || (activeInputTab === "paste" && !rawText.trim())
                      ? "bg-slate-300 cursor-not-allowed text-slate-500 shadow-none"
                      : "bg-teal-600 hover:bg-teal-700 active:bg-teal-800"
                  }`}
                  id="parse_btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gemini 3.5 parsing statement & mapping to Tally...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" />
                      <span>
                        {activeInputTab === "upload" && uploadedFile?.name.endsWith(".pdf")
                          ? "Convert PDF Statement with Gemini AI"
                          : "Convert with Gemini 3.5 AI"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Row 3: Interactive Table & Editor */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col gap-4" id="table_section">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full">
                    {transactions.length}
                  </span>
                  <h2 className="font-display font-semibold text-slate-900">Voucher Transactions</h2>
                </div>
                <button
                  onClick={handleAddTransaction}
                  className="inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100/50 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                  id="add_voucher_btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm font-medium">No transactions listed yet.</p>
                  <p className="text-xs mt-1">Select an input method above, import your file, or add records manually.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                        <th className="py-2.5 px-4 w-12 text-center">Type</th>
                        <th className="py-2.5 px-4 w-32">Date</th>
                        <th className="py-2.5 px-4">Narration / Details</th>
                        <th className="py-2.5 px-4 w-28">Ref No / Chq</th>
                        <th className="py-2.5 px-4 w-28 text-right">Amount</th>
                        <th className="py-2.5 px-4 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateField(t.id, "type", t.type === "credit" ? "debit" : "credit")}
                              className={`p-1.5 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                t.type === "credit"
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                              }`}
                              title={t.type === "credit" ? "Credit / Inflow (Receipt)" : "Debit / Outflow (Payment)"}
                            >
                              {t.type === "credit" ? (
                                <ArrowDownLeft className="w-4 h-4" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="date"
                              value={t.date}
                              onChange={(e) => handleUpdateField(t.id, "date", e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1 font-mono text-xs text-slate-700"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={t.description}
                              onChange={(e) => handleUpdateField(t.id, "description", e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1 text-slate-800"
                              placeholder="Transaction details..."
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={t.refNo}
                              onChange={(e) => handleUpdateField(t.id, "refNo", e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1 font-mono text-xs text-slate-600"
                              placeholder="Cheque / Ref"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={t.amount === 0 ? "" : t.amount}
                              onChange={(e) => handleUpdateField(t.id, "amount", e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1 text-right font-mono text-slate-800"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50/50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mini Stats Summary */}
              {transactions.length > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-3 text-xs mt-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total Records</span>
                    <span className="text-sm font-semibold text-slate-700">{stats.total} Vouchers</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total Credits (In)</span>
                    <span className="text-sm font-semibold text-emerald-600">₹{stats.credits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total Debits (Out)</span>
                    <span className="text-sm font-semibold text-rose-600">₹{stats.debits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT SIDE: LIVE TALLY XML PREVIEW */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[calc(100vh-140px)] min-h-[500px]" id="xml_section">
              {/* Toolbar */}
              <div className="bg-slate-950 px-5 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <h2 className="font-display font-semibold text-slate-200 text-sm">
                    Tally XML Output
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      copied 
                        ? "bg-emerald-600 text-white" 
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                    id="copy_xml_btn"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy XML</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                    id="download_xml_btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* XML Source Window */}
              <div className="flex-1 overflow-y-auto p-5 font-mono text-xs text-slate-300 leading-relaxed selection:bg-slate-800 selection:text-teal-400">
                <pre className="whitespace-pre-wrap word-break-all bg-transparent border-0 p-0 text-[11px] text-teal-400/90 font-mono">
                  {xmlOutput}
                </pre>
              </div>

              {/* Guidelines checklist */}
              <div className="bg-slate-950 p-4 border-t border-slate-800 text-[11px] text-slate-500">
                <p className="font-semibold text-slate-400 mb-1">Double Entry Check:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Receipts (Money In): Bank gets DEBITED (<span className="text-emerald-500">YES</span>), Suspense gets CREDITED (<span className="text-rose-500">NO</span>).</li>
                  <li>Payments (Money Out): Bank gets CREDITED (<span className="text-rose-500">NO</span>), Suspense gets DEBITED (<span className="text-emerald-500">YES</span>).</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-400 font-mono">
            Bank Statement to Tally XML Parser v1.1 • Built with Gemini 3.5 AI & React 19
          </p>
        </div>
      </footer>
    </div>
  );
}
