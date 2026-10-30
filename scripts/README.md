# scripts

Top-level maintenance scripts (Python):

- `recover_maral_master_data.py`: read-only planner plus guarded, additive recovery of master data between two PostgreSQL containers, with hash checks on source and target data.
- `test_recover_maral_master_data.py`: tests for the recovery script.
- `generate_john_guide.py`: renders the Markdown staff guide to a styled PDF with reportlab.

Run them only against a copy of the database first. Connection details come from environment variables.
