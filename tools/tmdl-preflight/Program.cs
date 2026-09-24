using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.AnalysisServices.Tabular;

namespace AtlynPareto.TmdlPreflight;

// Real TOM preflight for the Pareto sample's TMDL semantic model.
//
// This tool loads the actual Microsoft Analysis Services Tabular Object Model
// (Microsoft.AnalysisServices.retail.amd64, a public NuGet package) and calls
// TmdlSerializer.DeserializeDatabaseFromFolder against the assembled sample's
// "definition" folder. This is a genuine TOM parse of the same TMDL grammar
// Power BI Desktop uses, not a regex/text approximation.
//
// Boundary: this still does not launch Desktop, and does not by itself prove
// native report open, Refresh, render, export, or certification acceptance.
// It proves the TMDL definition folder is well-formed and loads into a real
// TOM Database object with the expected shape.
internal static class Program
{
    private static readonly Dictionary<string, (string[] Columns, string[] Measures)> ExpectedTables = new()
    {
        ["Defects"] = (new[] { "Category", "DefectCount", "ReworkMinutes" }, new[] { "Total defects", "Total rework minutes" }),
        ["Complaints"] = (new[] { "Category", "ComplaintCostUSD", "ComplaintCount" }, new[] { "Total complaint cost", "Total complaints" }),
        ["CustomerRevenue"] = (new[] { "Category", "RevenueUSD", "InvoiceCount" }, new[] { "Total customer revenue", "Total invoices" })
    };

    private static int Main(string[] args)
    {
        try
        {
            var sampleDirectory = args.Length > 0
                ? args[0]
                : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "artifacts", "sample");
            var evidencePath = args.Length > 1
                ? args[1]
                : Path.Combine(sampleDirectory, "..", "sample-tmdl-tom-preflight.json");

            var sampleRoot = Path.GetFullPath(sampleDirectory);
            if (!Directory.Exists(sampleRoot))
            {
                throw new InvalidOperationException($"Sample directory not found: {sampleRoot}. Run \"npm run sample\" first.");
            }

            var manifestPath = Path.Combine(sampleRoot, "sample-manifest.json");
            string? packageSha256 = null;
            if (File.Exists(manifestPath))
            {
                using var manifestDoc = JsonDocument.Parse(File.ReadAllText(manifestPath));
                packageSha256 = manifestDoc.RootElement.GetProperty("package").GetProperty("sha256").GetString();
            }

            var definitionRoot = Path.Combine(sampleRoot, "Atlyn Pareto.SemanticModel", "definition");
            if (!Directory.Exists(definitionRoot))
            {
                throw new InvalidOperationException($"TMDL definition folder not found: {definitionRoot}");
            }

            Database database = TmdlSerializer.DeserializeDatabaseFromFolder(definitionRoot);
            try
            {
                if (database.CompatibilityLevel != 1601)
                {
                    throw new InvalidOperationException($"Expected compatibility level 1601, got {database.CompatibilityLevel}.");
                }

                var model = database.Model;
                var actualTableNames = model.Tables.Select(t => t.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();
                var expectedTableNames = ExpectedTables.Keys.OrderBy(n => n, StringComparer.Ordinal).ToArray();
                if (!actualTableNames.SequenceEqual(expectedTableNames))
                {
                    throw new InvalidOperationException(
                        $"Expected tables [{string.Join(", ", expectedTableNames)}], got [{string.Join(", ", actualTableNames)}].");
                }

                var tableEvidence = new List<object>();
                foreach (var table in model.Tables)
                {
                    var (expectedColumns, expectedMeasures) = ExpectedTables[table.Name];
                    var actualColumns = table.Columns.Select(c => c.Name).ToArray();
                    var actualMeasures = table.Measures.Select(m => m.Name).ToArray();

                    foreach (var column in expectedColumns)
                    {
                        if (!actualColumns.Contains(column))
                        {
                            throw new InvalidOperationException($"Table {table.Name} is missing expected column {column}.");
                        }
                    }
                    foreach (var measure in expectedMeasures)
                    {
                        if (!actualMeasures.Contains(measure))
                        {
                            throw new InvalidOperationException($"Table {table.Name} is missing expected measure {measure}.");
                        }
                    }

                    if (table.Partitions.Count != 1)
                    {
                        throw new InvalidOperationException($"Table {table.Name} must have exactly one partition, has {table.Partitions.Count}.");
                    }
                    var partition = table.Partitions[0];
                    if (partition.Mode != ModeType.Import)
                    {
                        throw new InvalidOperationException($"Table {table.Name} partition must be Import mode, is {partition.Mode}.");
                    }
                    if (partition.Source is not MPartitionSource mSource)
                    {
                        throw new InvalidOperationException($"Table {table.Name} partition must be an M partition source.");
                    }
                    var expression = mSource.Expression;
                    if (!expression.Contains("#table(", StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException($"Table {table.Name} M expression must embed a #table(...) literal.");
                    }
                    if (System.Text.RegularExpressions.Regex.IsMatch(expression, @"(?:File|Web|Sql)\.Contents|https?:|[A-Z]:\\"))
                    {
                        throw new InvalidOperationException($"Table {table.Name} M expression references an external data source.");
                    }
                    if (table.Name == "CustomerRevenue" && expression.Contains("Table.TransformColumnTypes(Source", StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException("CustomerRevenue must use a self-contained typed #table source without a cyclic transform.");
                    }

                    tableEvidence.Add(new
                    {
                        name = table.Name,
                        columns = actualColumns,
                        measures = actualMeasures,
                        partitions = table.Partitions.Count,
                        partitionMode = partition.Mode.ToString()
                    });
                }

                var evidence = new
                {
                    status = "passed",
                    checkedAtUtc = DateTimeOffset.UtcNow.ToString("o"),
                    packageSha256,
                    method = "Microsoft.AnalysisServices.Tabular.TmdlSerializer.DeserializeDatabaseFromFolder (real TOM parse)",
                    tomAssemblyVersion = typeof(Database).Assembly.GetName().Version?.ToString(),
                    compatibilityLevel = database.CompatibilityLevel,
                    tables = tableEvidence,
                    boundary = "Genuine TOM object-model parse of the TMDL definition folder. It does not establish native Desktop open, refresh, render, export or host acceptance."
                };

                var output = Path.GetFullPath(evidencePath);
                Directory.CreateDirectory(Path.GetDirectoryName(output)!);
                File.WriteAllText(output, System.Text.Json.JsonSerializer.Serialize(evidence, new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine);

                Console.WriteLine(
                    $"Real TOM preflight passed: {tableEvidence.Count} tables, compatibility level {database.CompatibilityLevel}. Evidence: {output}");
                return 0;
            }
            finally
            {
                database.Dispose();
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"TOM preflight FAILED: {ex.Message}");
            return 1;
        }
    }
}
