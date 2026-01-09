import React from 'react';
import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Icon,
} from '@chakra-ui/react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';

const ExportButton = ({ data, fileName = 'export', onExport }) => {
  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    onExport?.('csv');
  };

  const exportToJSON = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    onExport?.('json');
  };

  return (
    <Menu>
      <MenuButton
        as={Button}
        leftIcon={<FiDownload />}
        colorScheme="blue"
        variant="outline"
        size="sm"
      >
        Export
      </MenuButton>
      <MenuList>
        <MenuItem icon={<FiFileText />} onClick={exportToCSV}>
          Export as CSV
        </MenuItem>
        <MenuItem icon={<FiFile />} onClick={exportToJSON}>
          Export as JSON
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default ExportButton;