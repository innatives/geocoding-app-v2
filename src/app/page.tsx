'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, Upload, Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Progress } from '../components/ui/progress';

interface GeocodingResults {
  totalRows: number;
  processedRows: number;
  skippedRows: number[];
  errors: Array<{
    row: number;
    error: string;
    location: string;
  }>;
}

export default function GeocodingApp() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [addressCol, setAddressCol] = useState('');
  const [cityCol, setCityCol] = useState('');
  const [countryCol, setCountryCol] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<GeocodingResults | null>(null);
  const [geocodedData, setGeocodedData] = useState<any[] | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFile(file);
    setError('');
    setResults(null);
    setGeocodedData(null);

    Papa.parse(file, {
      complete: (results) => {
        if (results.data.length > 0) {
          setHeaders(results.data[0] as string[]);
        }
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const geocodeAddress = async (address: string): Promise<any> => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${data.status}`);
    }
    
    return data;
  };

  const processFile = async () => {
    if (!file || (!addressCol && !cityCol && !countryCol)) {
      setError('Please select a file and at least one location column');
      return;
    }

    if (!apiKey) {
      setError('Please enter your Google Maps API Key');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress(0);

    try {
      const results: GeocodingResults = {
        totalRows: 0,
        processedRows: 0,
        skippedRows: [],
        errors: [],
      };

      const processedData: any[] = [];

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async ({ data }) => {
          results.totalRows = data.length;
          const processed = [];

          for (let i = 0; i < data.length; i++) {
            const row = data[i] as any;
            const locationParts = [];

            if (addressCol && row[addressCol]) locationParts.push(row[addressCol]);
            if (cityCol && row[cityCol]) locationParts.push(row[cityCol]);
            if (countryCol && row[countryCol]) locationParts.push(row[countryCol]);

            const newRow = { ...row };

            if (locationParts.length > 0) {
              try {
                const locationString = locationParts.join(', ');
                const response = await geocodeAddress(locationString);
                
                if (response.results?.[0]) {
                  const location = response.results[0].geometry.location;
                  newRow.Latitude = location.lat;
                  newRow.Longitude = location.lng;
                  results.processedRows++;
                } else {
                  results.skippedRows.push(i + 1);
                }
              } catch (error) {
                results.errors.push({
                  row: i + 1,
                  error: (error as Error).message,
                  location: locationParts.join(', '),
                });
                results.skippedRows.push(i + 1);
              }
            } else {
              results.skippedRows.push(i + 1);
            }

            processed.push(newRow);
            setProgress((i + 1) / data.length * 100);
            
            // Add delay to avoid hitting API rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          setResults(results);
          setGeocodedData(processed);
          setProcessing(false);
        },
        error: (error) => {
          setError(`Error processing file: ${error.message}`);
          setProcessing(false);
        },
      });
    } catch (error) {
      setError(`Error: ${(error as Error).message}`);
      setProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!geocodedData) return;

    const csv = Papa.unparse(geocodedData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geocoded_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>CSV Geocoding Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload CSV File
            </label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mb-4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Google Maps API Key
            </label>
            <Input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="mb-4"
            />
          </div>

          {headers.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Address Column
                </label>
                <Select value={addressCol} onValueChange={setAddressCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  City Column
                </label>
                <Select value={cityCol} onValueChange={setCityCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Country Column
                </label>
                <Select value={countryCol} onValueChange={setCountryCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {processing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-gray-500 text-center">
                Processing... {Math.round(progress)}%
              </p>
            </div>
          )}

          {results && (
            <Alert>
              <AlertTitle>Processing Complete</AlertTitle>
              <AlertDescription>
                Processed {results.processedRows} out of {results.totalRows} rows.
                {results.skippedRows.length > 0 && (
                  <p>Skipped {results.skippedRows.length} rows.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4">
            <Button
              onClick={processFile}
              disabled={processing || !file}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Process File
            </Button>

            {geocodedData && (
              <Button onClick={downloadResults} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download Results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
