import re
import codecs

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

# 1. Update ProactiveHealthCenter
new_phc = """function ProactiveHealthCenter({ customers = [] }) {
  // Generate alerts based on live customer data
  const alerts = customers.map(c => {
    const isOverdue = c.paymentStatus === "Overdue";
    const risk = isOverdue ? "Critical" : c.churnProbability > 70 ? "Critical" : c.churnProbability > 40 ? "At Risk" : "Healthy";
    const category = isOverdue ? "Overdue Payment" : c.isPremiumActive === false ? "Quiet Payer" : "High Churn Risk";
    
    if (risk === "Healthy") return null;
    
    return {
      id: c.firestoreId || c.email,
      name: c.name,
      category,
      rar: parseFloat(c.totalPaid) || 0,
      risk,
      badgeCls: risk === "Critical" ? "text-rose-700 bg-rose-50 border border-rose-100" : "text-amber-700 bg-amber-50 border border-amber-100",
      actionLabel: risk === "Critical" ? "Assign CSM" : "Outreach"
    };
  }).filter(Boolean).sort((a,b) => b.rar - a.rar).slice(0, 5);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
          </span>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Proactive Health Alerts</h3>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold ml-1">
            {alerts.length} action items
          </span>
        </div>
        <p className="text-[10px] text-slate-400">Updates live from Firestore</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 border-b border-gray-200 uppercase font-semibold text-[10px]">
              <th className="px-4 py-2 text-left">Customer Name</th>
              <th className="px-4 py-2 text-left">Risk Category</th>
              <th className="px-4 py-2 text-right">Revenue-at-Risk</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {alerts.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-2 font-bold text-slate-900">{row.name}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.badgeCls}`}>
                      {row.risk}
                    </span>
                    <span className="text-[11px] text-slate-600">{row.category}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono font-bold text-slate-950">
                  {fmtFull(row.rar)}
                </td>
                <td className="px-4 py-2 text-center">
                  <button className="px-2.5 py-1 text-[10px] font-bold bg-white border border-gray-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors shadow-sm cursor-pointer">
                    {row.actionLabel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}"""

content = re.sub(r'function ProactiveHealthCenter\(\) \{.*?(?=\n// ─── METRICS FORMULA GUIDE ───)', new_phc + '\n', content, flags=re.DOTALL)

# 2. Update DashboardView
new_dashboard = """function DashboardView({ customers = [] }) {
  const S = customers.length || 1;
  const churned = customers.filter(c => parseFloat(c.churnProbability) > 80).length;
  const ARPU = customers.reduce((sum, c) => sum + (parseFloat(c.packagePrice) || 0), 0) / S || 0;
  
  const retentionRate = ((S - churned) / S) * 100;
  const churnRate = (churned / S) * 100;
  const clv = churnRate > 0 ? ARPU / (churnRate / 100) : ARPU * 12;
  const nps = 45; // static placeholder for NPS since it's survey-based

  const sortedCustomers = [...customers].sort((a, b) => (parseFloat(b.churnProbability) || 0) - (parseFloat(a.churnProbability) || 0)).slice(0, 10);
  
  const stages = { Onboarding: 0, Engagement: 0, Retention: 0, Loyalty: 0 };
  customers.forEach(c => { if(stages[c.stage] !== undefined) stages[c.stage]++; });
  const lifecycleData = Object.keys(stages).map(k => ({ stage: k, count: stages[k] }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShieldCheck} label="Retention Rate" formulaKey="retention" value={`${retentionRate.toFixed(1)}%`} formulaHint={`(Active ÷ Total) × 100`} color="bg-gradient-to-br from-blue-600 to-indigo-600" />
        <KpiCard icon={TrendingDown} label="Churn Rate" formulaKey="churn" value={`${churnRate.toFixed(1)}%`} formulaHint={`(Churned ÷ Total) × 100`} color="bg-gradient-to-br from-rose-500 to-rose-600" />
        <KpiCard icon={DollarSign} label="Avg CLV" formulaKey="clv" value={fmt(clv)} formulaHint={`ARPU ÷ Churn Rate`} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <KpiCard icon={Heart} label="Avg Usage Score" formulaKey="nps" value={`${(customers.reduce((a,c) => a+(parseFloat(c.usageScore)||0),0)/S || 0).toFixed(0)}/100`} formulaHint={`Platform Engagement`} color="bg-gradient-to-br from-purple-500 to-violet-600" />
      </div>

      <ProactiveHealthCenter customers={customers} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lifecycle Pipeline */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lifecycle Pipeline</h3>
              <p className="text-[10px] text-slate-400">Live distribution of accounts</p>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-gray-200">Total: {S}</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycleData} layout="vertical" margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#475569", fontWeight: "bold" }} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 4, background: "#1e293b", color: "#fff", border: "none" }} />
                <Bar dataKey="count" fill="#475569" barSize={12} radius={[0, 2, 2, 0]}>
                  {lifecycleData.map((entry, index) => <Cell key={`cell-${index}`} fill={STAGE_STYLE[entry.stage]?.hex || "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Priority Action List</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Top accounts by churn probability</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 h-44">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-slate-500 border-b border-gray-200 uppercase font-semibold text-[10px]">
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-right">Churn %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedCustomers.map((c) => (
                  <tr key={c.firestoreId || c.email} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-bold text-slate-900 truncate max-w-[120px]">{c.name}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border
                        ${c.stage === "Retention" ? "bg-amber-50 text-amber-700 border-amber-100" :
                          c.stage === "Engagement" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          c.stage === "Onboarding" ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                     "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono font-bold ${c.churnProbability > 65 ? "text-rose-600" : "text-amber-600"}`}>
                        {c.churnProbability}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <FormulaGuide />
    </div>
  );
}"""
content = re.sub(r'function DashboardView\(\) \{.*?(?=\n// ─── CUSTOMER 360 PROFILE ───)', new_dashboard + '\n', content, flags=re.DOTALL)

# 3. Update Customer360View
new_c360 = """function Customer360View({ customers = [], addCustomers, updateCustomer }) {
  const [file, setFile] = useState(null);
  const [mapperData, setMapperData] = useState(null); // { parsedRows, canonicalCols, otherCols, mapping }
  const [selectedId, setSelectedId] = useState(customers.length > 0 ? customers[0].firestoreId : null);
  
  const customer = customers.find(c => c.firestoreId === selectedId) || customers[0];

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws);
      
      if (rawData.length === 0) return;
      
      const parsedRows = rawData.map(row => normalizeRow(row));
      
      // Analyze unmapped keys across all rows
      const allOthers = new Set();
      parsedRows.forEach(pr => pr.unmappedKeys.forEach(k => allOthers.add(k)));
      
      if (allOthers.size > 0) {
        // Show mapping UI
        setMapperData({
          parsedRows,
          otherCols: Array.from(allOthers),
          mapping: {}
        });
      } else {
        // Direct save if clean
        addCustomers(parsedRows.map(pr => pr.canonical));
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const confirmMapping = () => {
    if (!mapperData) return;
    const finalData = mapperData.parsedRows.map(pr => applyMapping(pr.canonical, mapperData.mapping));
    addCustomers(finalData);
    setMapperData(null);
  };

  if (mapperData) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Map Unrecognized Columns</h2>
        <p className="text-xs text-slate-500 mb-6">We found columns that don't match our standard format. Please map them below or leave them as 'Others'.</p>
        
        <div className="space-y-4 mb-6">
          {mapperData.otherCols.map(col => (
            <div key={col} className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="w-1/3 text-sm font-semibold text-slate-700 bg-white px-2 py-1 border rounded">{col}</span>
              <span>→</span>
              <select 
                className="flex-1 p-2 border rounded text-sm bg-white"
                value={mapperData.mapping[col] || "__others__"}
                onChange={(e) => setMapperData(prev => ({...prev, mapping: {...prev.mapping, [col]: e.target.value}}))}
              >
                <option value="__others__">Keep in 'Others'</option>
                {CANONICAL_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3">
          <button onClick={() => setMapperData(null)} className="px-4 py-2 border rounded text-sm text-slate-600">Cancel</button>
          <button onClick={confirmMapping} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow-sm">Save to Firebase</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-4 gap-4">
         <div className="bg-slate-900 text-white p-4 rounded-md shadow-sm">
           <p className="text-[10px] uppercase font-bold text-slate-400">Total Customers</p>
           <p className="text-2xl font-bold mt-1">{customers.length}</p>
         </div>
         <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm">
           <p className="text-[10px] uppercase font-bold text-slate-500">Active Premium %</p>
           <p className="text-2xl font-bold mt-1 text-emerald-600">
             {customers.length ? ((customers.filter(c => c.isPremiumActive).length / customers.length) * 100).toFixed(1) : 0}%
           </p>
         </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded border border-gray-200">
        <div className="relative">
          <input type="text" placeholder="Search customers..." className="pl-8 pr-4 py-1.5 text-sm border rounded bg-slate-50 focus:bg-white transition-colors" />
          <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold cursor-pointer transition-colors">
            <Upload size={14} /> Import CSV/Excel
            <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex gap-6 h-[600px]">
        {/* Table List */}
        <div className="flex-1 bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-50 border-b border-gray-200 shadow-sm z-10">
                <tr className="uppercase font-semibold text-[10px] text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">LTV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr key={c.firestoreId} onClick={() => setSelectedId(c.firestoreId)} className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedId === c.firestoreId ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[10px] text-slate-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded font-semibold text-[10px] text-slate-700">{c.package || "N/A"}</span></td>
                    <td className="px-4 py-3">
                      {c.isPremiumActive 
                        ? <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={12}/> Active</span>
                        : <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertTriangle size={12}/> Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">${c.totalPaid || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Panel */}
        {customer && (
          <div className="w-96 bg-white border border-gray-200 rounded-md overflow-y-auto p-5 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
                <p className="text-xs text-slate-500">{customer.company} · {customer.country}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${customer.isPremiumActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {customer.isPremiumActive ? "Premium Active" : "Inactive"}
              </span>
            </div>
            
            <div className="space-y-5">
              <div>
                <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-2 border-b pb-1">Usage Data</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-[9px] uppercase text-slate-500 font-semibold">Last Login</p>
                    <p className="text-xs font-bold mt-0.5">{customer.lastLoginDate || "Never"}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-[9px] uppercase text-slate-500 font-semibold">Features Used</p>
                    <p className="text-xs font-bold mt-0.5">{customer.premiumFeaturesUsed || 0}</p>
                  </div>
                </div>
              </div>

              {customer.others && Object.keys(customer.others).length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-2 border-b pb-1 flex items-center gap-1">
                    <Info size={10} /> Other Data Fields
                  </h3>
                  <div className="bg-orange-50 border border-orange-100 rounded p-3 space-y-1.5">
                    {Object.entries(customer.others).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="font-semibold text-orange-800">{k}:</span>
                        <span className="text-orange-900">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}"""
content = re.sub(r'function Customer360View\(\) \{.*?(?=\n// ─── CHART TOOLTIP ───)', new_c360 + '\n', content, flags=re.DOTALL)

# 4. Update InsightsView
new_insights = """function InsightsView({ customers = [] }) {
  const activeCount = customers.filter(c => c.isPremiumActive).length;
  const inactiveCount = customers.length - activeCount;

  const clusterData = [
    { name: "Active Premium", value: customers.length ? Math.round((activeCount / customers.length)*100) : 0, color: "#10b981" },
    { name: "Quiet Payer", value: customers.length ? Math.round((inactiveCount / customers.length)*100) : 0, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Customer Segment Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clusterData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value">
                  {clusterData.map(e => <Cell key={e.name} fill={e.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} formatter={(v, n) => [`${v}%`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}"""
content = re.sub(r'function InsightsView\(\) \{.*?(?=\n// ─── SIMULATOR VIEW ───|\nfunction SimulatorView)', new_insights + '\n', content, flags=re.DOTALL)

# 5. Inject useCustomers hook into App
app_injection = """function App() {
  const [appState, setAppState] = useState("landing"); // "landing" | "login" | "console"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  
  const { customers, loading, error, addCustomers, updateCustomer, deleteCustomer } = useCustomers();

  const handleTabChange = (tab) => {
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransitioning(false);
    }, 150);
  };

  const renderView = () => {
    switch (activeTab) {
      case "dashboard":  return <DashboardView customers={customers} />;
      case "customers":  return <Customer360View customers={customers} addCustomers={addCustomers} updateCustomer={updateCustomer} />;
      case "insights":   return <InsightsView customers={customers} />;
      case "simulator":  return <SimulatorView />;
      case "reports":    return <ReportsView />;
      default: return null;
    }
  };"""

content = re.sub(r'function App\(\) \{.*?(?=  const currentNav = )', app_injection + '\n\n', content, flags=re.DOTALL)

with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
