# @proseva/datasets

This package contains datasets used by the Proseva platform, primarily focused on Virginia judicial and legal resources.
They are updated automatically once per month.
## Datasets

The following datasets are available in the `data/` directory:

| Dataset | Description | Source |
|:---|:---|:---|
| `annual_reports` | State of the Judiciary Annual Reports. Includes historical PDFs and recent HTML versions. | [Virginia Judiciary](https://www.vacourts.gov/news/items/sjr/home.html) |
| `appellate_caseload` | Caseload statistics for the Supreme Court of Virginia (SCV) and Court of Appeals of Virginia (CAV). | [Virginia Judiciary](https://www.vacourts.gov/courtadmin/aoc/djs/programs/cpss/home.html) |
| `benchbook` | District Court Judges' Benchbook, a comprehensive reference for Virginia district court judges. | [Virginia Judiciary](https://www.vacourts.gov/courts/gd/resources/manuals/home.html) |
| `cac_manual` | Commissioners of Accounts Compliance (CAC) Manual and indigency guidelines. | [Virginia Judiciary](https://www.vacourts.gov/courtadmin/aoc/djs/programs/cac/home.html) |
| `case_law_authorities` | CSV data for Virginia authorities, charters, compacts, and uncodified acts. | [Virginia Legislative Information System (LIS)](https://law.lis.virginia.gov/CSV/) |
| `caseload_stats` | General caseload statistics for Circuit, General District, and J&DR courts. | [Virginia Judiciary](https://www.vacourts.gov/courtadmin/aoc/djs/programs/cpss/home.html) |
| `constitutional_law` | The Constitution of Virginia in CSV format. | [Virginia Legislative Information System (LIS)](https://law.lis.virginia.gov/CSV/) |
| `courts` | JSON data containing information about Virginia courts, including names, types, and locations. | Internal/Virginia Judiciary |
| `gdman` | General District Court Manual (Procedures and Guidelines). | [Virginia Judiciary](https://www.vacourts.gov/courts/gd/resources/manuals/home.html) |
| `jdrman` | Juvenile and Domestic Relations (J&DR) District Court Manual. | [Virginia Judiciary](https://www.vacourts.gov/courts/jdr/resources/manuals/home.html) |
| `vcc` | Virginia Crime Code (VCC) Book, containing codes used for charging and sentencing. | [Virginia Criminal Sentencing Commission](http://www.vcsc.virginia.gov/VCCs/) |
| `virginia_code` | The Code of Virginia (all titles) in CSV format. | [Virginia Legislative Information System (LIS)](https://law.lis.virginia.gov/CSV/) |
| `other` | Miscellaneous legal resources including Rules of Court, District Courts Directory, and Small Claims Court Procedures. | [Virginia Judiciary](https://www.vacourts.gov/) |

## Maintenance

Datasets are periodically updated from their respective sources using Bun scripts located in `src/refresh-scripts/`.

### Refreshing Datasets

To refresh all datasets, run the following command from the package root:

```bash
bun run src/refresh.ts
```

Alternatively, you can run individual scripts:

```bash
bun src/refresh-scripts/update-annual-reports-dataset.ts
```

*Note: Some scripts (e.g., those fetching from `law.lis.virginia.gov`) may bypass SSL certificate verification due to known issues with the source server's certificate chain.*