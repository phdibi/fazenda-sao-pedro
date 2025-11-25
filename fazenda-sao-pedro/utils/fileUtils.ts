const escapeCSV = (value: any): string => {
    if (value == null) {
        return '';
    }
    const str = String(value);
    // If the string contains a comma, double quote, or newline, wrap it in double quotes
    // and escape any existing double quotes by doubling them.
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export const exportToCSV = (data: Record<string, any>[], headers: Record<string, string>, filename: string) => {
    const headerKeys = Object.keys(headers);
    const headerValues = Object.values(headers);
    
    const csvRows = [headerValues.join(',')];

    for (const row of data) {
        const values = headerKeys.map(key => escapeCSV(row[key]));
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for BOM to handle UTF-8 in Excel

    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};