// Telecom-specific calculations
export const calculateTelecomKPIs = (cdrs) => {
  const totalCalls = cdrs.length;
  const answeredCalls = cdrs.filter(c => c.status === 'ANSWERED').length;
  const failedCalls = cdrs.filter(c => c.status === 'FAILED').length;
  const totalDuration = cdrs.reduce((sum, c) => sum + (c.duration || 0), 0);
  
  return {
    // ASR - Answer Seizure Ratio
    asr: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
    
    // ACD - Average Call Duration
    acd: answeredCalls > 0 ? totalDuration / answeredCalls : 0,
    
    // NER - Network Efficiency Ratio
    ner: totalCalls > 0 ? ((answeredCalls + (failedCalls * 0.3)) / totalCalls) * 100 : 0,
    
    // CCR - Call Completion Rate
    ccr: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
    
    // PDD - Post Dial Delay (would need callerpdd field)
    avgPdd: 0,
  };
};

export const calculateRouteQuality = (cdrs) => {
  const routes = {};
  
  cdrs.forEach(cdr => {
    const routeKey = `${cdr.callere164?.slice(0,6)}-${cdr.calleee164?.slice(0,6)}`;
    if (!routes[routeKey]) {
      routes[routeKey] = {
        calls: 0,
        answered: 0,
        duration: 0,
        revenue: 0,
      };
    }
    
    routes[routeKey].calls++;
    if (cdr.status === 'ANSWERED') {
      routes[routeKey].answered++;
      routes[routeKey].duration += cdr.duration || 0;
    }
    routes[routeKey].revenue += cdr.fee || 0;
  });
  
  return Object.entries(routes).map(([route, stats]) => ({
    route,
    ...stats,
    asr: (stats.answered / stats.calls) * 100,
    acd: stats.answered > 0 ? stats.duration / stats.answered : 0,
  })).sort((a, b) => b.revenue - a.revenue);
};

export const calculateTimeBasedAnalysis = (cdrs) => {
  const hourlyStats = Array(24).fill(0).map((_, hour) => ({
    hour,
    calls: 0,
    answered: 0,
    revenue: 0,
  }));
  
  cdrs.forEach(cdr => {
    try {
      const hour = new Date(cdr.starttime).getHours();
      hourlyStats[hour].calls++;
      if (cdr.status === 'ANSWERED') {
        hourlyStats[hour].answered++;
        hourlyStats[hour].revenue += cdr.fee || 0;
      }
    } catch (error) {
      // Skip invalid dates
    }
  });
  
  return hourlyStats;
};