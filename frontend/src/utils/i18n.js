/* utils/i18n.js — Multi-language support: English, Hindi, Marathi */

export const LANGUAGES = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi',   native: 'हिंदी',   flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी',   flag: '🇮🇳' },
};

const translations = {
  en: {
    // Nav
    nav_dashboard:    'Live Dashboard',
    nav_live:         'Live Monitor',
    nav_jobs:         'Video Jobs',
    nav_crossings:    'Footfall Log',
    nav_trends:       'Trends',
    nav_sales:        'Sales & Marketing',
    nav_inventory:    'Inventory',
    nav_security:     'Loss Prevention',
    nav_ai:           'AI Insights',
    nav_staff:        'Staff & Ops',
    nav_compliance:   'Compliance',
    nav_engagement:   'Engagement',
    nav_reports:      'Reports',
    nav_alerts:       'Alert Center',
    nav_bi:           'Report Builder',
    nav_platform:     'Platform Config',
    nav_edge:         'Edge & Cameras',
    nav_settings:     'Settings',
    // Common
    loading:          'Loading...',
    no_data:          'No data yet',
    save:             'Save',
    saved:            'Saved!',
    cancel:           'Cancel',
    delete:           'Delete',
    edit:             'Edit',
    add:              'Add',
    run:              'Run',
    download:         'Download',
    refresh:          'Refresh',
    enabled:          'Enabled',
    disabled:         'Disabled',
    status:           'Status',
    actions:          'Actions',
    total:            'Total',
    // KPIs
    kpi_entries:      'Total Entries',
    kpi_exits:        'Total Exits',
    kpi_peak:         'Peak Crowd',
    kpi_dwell:        'Avg Dwell',
    kpi_conversion:   'Conversion Rate',
    kpi_alerts:       'Active Alerts',
    // Alerts
    alert_critical:   'Critical Alert',
    alert_high:       'High Priority',
    alert_medium:     'Medium',
    alert_info:       'Info',
    // Zones
    zone_entrance:    'Entrance',
    zone_electronics: 'Electronics',
    zone_apparel:     'Apparel',
    zone_grocery:     'Grocery',
    zone_checkout:    'Checkout',
    // Reports
    report_pdf:       'Download PDF',
    report_excel:     'Download Excel',
    report_schedule:  'Schedule Report',
    // Misc
    online:           'Online',
    offline:          'Offline',
    healthy:          'Healthy',
    warning:          'Warning',
    critical:         'Critical',
    excellent:        'Excellent',
    good:             'Good',
    needs_improvement:'Needs Improvement',
  },

  hi: {
    // Nav
    nav_dashboard:    'लाइव डैशबोर्ड',
    nav_live:         'लाइव मॉनिटर',
    nav_jobs:         'वीडियो जॉब्स',
    nav_crossings:    'फुटफॉल लॉग',
    nav_trends:       'ट्रेंड्स',
    nav_sales:        'बिक्री और मार्केटिंग',
    nav_inventory:    'इन्वेंटरी',
    nav_security:     'लॉस प्रिवेंशन',
    nav_ai:           'AI इनसाइट्स',
    nav_staff:        'स्टाफ और ऑपरेशन',
    nav_compliance:   'अनुपालन',
    nav_engagement:   'ग्राहक जुड़ाव',
    nav_reports:      'रिपोर्ट्स',
    nav_alerts:       'अलर्ट सेंटर',
    nav_bi:           'रिपोर्ट बिल्डर',
    nav_platform:     'प्लेटफॉर्म सेटिंग',
    nav_edge:         'एज और कैमरे',
    nav_settings:     'सेटिंग्स',
    // Common
    loading:          'लोड हो रहा है...',
    no_data:          'अभी कोई डेटा नहीं',
    save:             'सेव करें',
    saved:            'सेव हो गया!',
    cancel:           'रद्द करें',
    delete:           'हटाएं',
    edit:             'संपादित करें',
    add:              'जोड़ें',
    run:              'चलाएं',
    download:         'डाउनलोड',
    refresh:          'रिफ्रेश',
    enabled:          'सक्रिय',
    disabled:         'निष्क्रिय',
    status:           'स्थिति',
    actions:          'कार्रवाई',
    total:            'कुल',
    // KPIs
    kpi_entries:      'कुल प्रवेश',
    kpi_exits:        'कुल निकास',
    kpi_peak:         'अधिकतम भीड़',
    kpi_dwell:        'औसत रुकने का समय',
    kpi_conversion:   'रूपांतरण दर',
    kpi_alerts:       'सक्रिय अलर्ट',
    // Alerts
    alert_critical:   'गंभीर अलर्ट',
    alert_high:       'उच्च प्राथमिकता',
    alert_medium:     'मध्यम',
    alert_info:       'जानकारी',
    // Zones
    zone_entrance:    'प्रवेश द्वार',
    zone_electronics: 'इलेक्ट्रॉनिक्स',
    zone_apparel:     'कपड़े',
    zone_grocery:     'किराना',
    zone_checkout:    'चेकआउट',
    // Reports
    report_pdf:       'PDF डाउनलोड करें',
    report_excel:     'Excel डाउनलोड करें',
    report_schedule:  'रिपोर्ट शेड्यूल करें',
    // Misc
    online:           'ऑनलाइन',
    offline:          'ऑफलाइन',
    healthy:          'स्वस्थ',
    warning:          'चेतावनी',
    critical:         'गंभीर',
    excellent:        'उत्कृष्ट',
    good:             'अच्छा',
    needs_improvement:'सुधार की जरूरत',
  },

  mr: {
    // Nav
    nav_dashboard:    'लाइव्ह डॅशबोर्ड',
    nav_live:         'लाइव्ह मॉनिटर',
    nav_jobs:         'व्हिडिओ जॉब्स',
    nav_crossings:    'फूटफॉल लॉग',
    nav_trends:       'ट्रेंड्स',
    nav_sales:        'विक्री आणि मार्केटिंग',
    nav_inventory:    'इन्व्हेंटरी',
    nav_security:     'नुकसान प्रतिबंध',
    nav_ai:           'AI अंतर्दृष्टी',
    nav_staff:        'कर्मचारी आणि ऑपरेशन',
    nav_compliance:   'अनुपालन',
    nav_engagement:   'ग्राहक सहभाग',
    nav_reports:      'अहवाल',
    nav_alerts:       'अलर्ट केंद्र',
    nav_bi:           'अहवाल बिल्डर',
    nav_platform:     'प्लॅटफॉर्म सेटिंग',
    nav_edge:         'एज आणि कॅमेरे',
    nav_settings:     'सेटिंग्ज',
    // Common
    loading:          'लोड होत आहे...',
    no_data:          'अद्याप डेटा नाही',
    save:             'जतन करा',
    saved:            'जतन झाले!',
    cancel:           'रद्द करा',
    delete:           'हटवा',
    edit:             'संपादित करा',
    add:              'जोडा',
    run:              'चालवा',
    download:         'डाउनलोड',
    refresh:          'रिफ्रेश',
    enabled:          'सक्रिय',
    disabled:         'निष्क्रिय',
    status:           'स्थिती',
    actions:          'क्रिया',
    total:            'एकूण',
    // KPIs
    kpi_entries:      'एकूण प्रवेश',
    kpi_exits:        'एकूण बाहेर पडणे',
    kpi_peak:         'जास्तीत जास्त गर्दी',
    kpi_dwell:        'सरासरी थांबण्याचा वेळ',
    kpi_conversion:   'रूपांतरण दर',
    kpi_alerts:       'सक्रिय अलर्ट',
    // Alerts
    alert_critical:   'गंभीर अलर्ट',
    alert_high:       'उच्च प्राधान्य',
    alert_medium:     'मध्यम',
    alert_info:       'माहिती',
    // Zones
    zone_entrance:    'प्रवेशद्वार',
    zone_electronics: 'इलेक्ट्रॉनिक्स',
    zone_apparel:     'कपडे',
    zone_grocery:     'किराणा',
    zone_checkout:    'चेकआउट',
    // Reports
    report_pdf:       'PDF डाउनलोड करा',
    report_excel:     'Excel डाउनलोड करा',
    report_schedule:  'अहवाल शेड्यूल करा',
    // Misc
    online:           'ऑनलाइन',
    offline:          'ऑफलाइन',
    healthy:          'निरोगी',
    warning:          'इशारा',
    critical:         'गंभीर',
    excellent:        'उत्कृष्ट',
    good:             'चांगले',
    needs_improvement:'सुधारणा आवश्यक',
  },
};

let _currentLang = localStorage.getItem('retail_lang') || 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    _currentLang = lang;
    localStorage.setItem('retail_lang', lang);
  }
}

export function getLanguage() {
  return _currentLang;
}

export function t(key) {
  return (translations[_currentLang] || translations.en)[key] || (translations.en)[key] || key;
}

export default { t, setLanguage, getLanguage, LANGUAGES };
