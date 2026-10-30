import csv
import io
import unittest
from unittest.mock import patch

import recover_maral_master_data as recovery
from recover_maral_master_data import build_plan, render_atomic_sql


class RecoveryTests(unittest.TestCase):
    def test_catalog_guard_casts_name_values_to_text_array(self):
        plan = build_plan([], [], [], [], [], [], [])
        sql = render_atomic_sql(plan.payload(), recovery.TABLE_COLUMNS,
                                "a" * 32, "b" * 32, plan.additions)
        self.assertIn("array_agg(tablename::text ORDER BY tablename)", sql)
        self.assertNotIn("array_agg(tablename ORDER BY tablename)", sql)

    def test_actual_dependency_json_keys_accept_zero_and_reject_nonzero_bom(self):
        schema = recovery.synthetic_schema()
        deps = {"source": {"productcomponents": 0, "categories": 0, "segments": 1},
                "target": {"productcomponents": 0, "categories": 0, "segments": 1}}
        recovery.validate_schema(schema, schema, dependencies=deps)
        deps["target"]["productcomponents"] = 1
        with self.assertRaises(ValueError):
            recovery.validate_schema(schema, schema, dependencies=deps)
        query = recovery._capture_sql(["Client"])
        self.assertIn("productcomponents", query)
        self.assertNotIn("productComponents", query)

    def test_unique_rut_maps_and_keeps_entire_existing_target_row(self):
        source = [{"id": "source", "rut": "EXACT", "merlinCode": None, "name": "Old"}]
        target_row = {"id": "target", "rut": "EXACT", "merlinCode": None,
                      "name": "Current Name", "stockLike": "preserved"}
        plan = build_plan(source, [target_row], [], [], [], [], [])
        self.assertEqual(plan.client_id_map["source"], "target")
        self.assertEqual(plan.clients_to_insert, [])
        self.assertEqual(target_row["name"], "Current Name")
        self.assertEqual(target_row["stockLike"], "preserved")

    def test_conflicting_rut_and_merlin_keys_raise(self):
        source = [{"id": "s", "rut": "R1", "merlinCode": "M1"}]
        target = [{"id": "t1", "rut": "R1", "merlinCode": "OTHER"},
                  {"id": "t2", "rut": "OTHER", "merlinCode": "M1"}]
        with self.assertRaises(ValueError):
            build_plan(source, target, [], [], [], [], [])

    def test_product_id_reference_collision_and_idempotent_rerun(self):
        with self.assertRaises(ValueError):
            build_plan([], [], [{"id": "same", "reference": "NEW"}],
                       [{"id": "same", "reference": "OLD"}], [], [], [])
        source = [{"id": "p", "reference": "REF", "stock": 8}]
        first = build_plan([], [], source, [], [], [], [])
        second = build_plan([], [], source, first.products_to_insert, [], [], [])
        self.assertEqual(len(first.products_to_insert), 1)
        self.assertEqual(second.products_to_insert, [])

    def test_existing_tag_and_client_link_remap_is_noop(self):
        clients = [{"id": "sc", "rut": "R", "merlinCode": None}]
        target_clients = [{"id": "tc", "rut": "R", "merlinCode": None}]
        tags = [{"id": "st", "name": "Priority"}]
        target_tags = [{"id": "tt", "name": "Priority"}]
        plan = build_plan(clients, target_clients, [], [], tags, target_tags,
                          [{"clientId": "sc", "tagId": "st"}],
                          [{"clientId": "tc", "tagId": "tt"}])
        self.assertEqual(plan.tag_id_map["st"], "tt")
        self.assertEqual(plan.client_tags_to_insert, [])
        self.assertEqual(plan.tags_to_insert, [])

    def test_unsafe_sql_identifier_is_rejected(self):
        with self.assertRaises(ValueError):
            recovery.quote_identifier('Client; DROP TABLE "User"')

    def test_docker_routing_uses_passed_container_database_and_readonly_setting(self):
        with patch.object(recovery.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = "[]\\n"
            run.return_value.stderr = ""
            recovery._docker_psql("expected-container", "maral_os", "SELECT 1", True)
        argv = run.call_args.args[0]
        self.assertIn("expected-container", argv)
        self.assertEqual(argv[-1], "maral_os")
        self.assertIn('psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', argv[-3])
        self.assertIn("default_transaction_read_only=on", argv[-3])

    def test_sql_inserts_only_four_whitelisted_tables(self):
        plan = build_plan([], [], [], [], [], [], [])
        sql = render_atomic_sql(plan.payload(), recovery.TABLE_COLUMNS, "a"*32, "b"*32,
                                plan.additions)
        inserts = [line for line in sql.splitlines() if line.startswith("INSERT INTO public.")]
        self.assertEqual(len(inserts), 4)
        self.assertEqual({line.split('public."')[1].split('"')[0] for line in inserts},
                         set(recovery.ALLOWED_TABLES))
        self.assertNotIn("UPDATE public", sql)
        self.assertNotIn("DELETE FROM", sql)
        self.assertNotIn("ON CONFLICT", sql)
    def test_historical_duplicate_keys_remain_distinct_and_rerun(self):
        src = [{"id": "a", "rut": "D", "merlinCode": "M"},
               {"id": "b", "rut": "D", "merlinCode": "M"}]
        first = build_plan(src, [], [], [], [], [], [])
        second = build_plan(src, first.clients_to_insert, [], [], [], [], [])
        self.assertEqual(len(first.clients_to_insert), 2)
        self.assertEqual(second.clients_to_insert, [])

    def test_referenced_tag_closure_and_link_pairs_deduplicate(self):
        clients = [{"id": "c", "rut": "r", "merlinCode": None}]
        tags = [{"id": "used", "name": "Used"}, {"id": "unused", "name": "Unused"}]
        links = [{"clientId": "c", "tagId": "used"}] * 2
        plan = build_plan(clients, [], [], [], tags, [], links)
        self.assertEqual([x["id"] for x in plan.tags_to_insert], ["used"])
        self.assertEqual(len(plan.client_tags_to_insert), 1)

    def test_actual_apply_stdin_places_csv_between_copy_and_terminator(self):
        plan = build_plan([{"id": "c", "rut": "r", "merlinCode": None}], [], [], [], [], [], [])
        with patch.object(recovery, "_docker_psql", return_value=("RECOVERY_COMMITTED", 0)) as psql:
            recovery._apply("container", "candidate", plan, "a" * 32,
                            "b" * 32, list(recovery.ALLOWED_TABLES))
        stream = psql.call_args.args[2]
        copy_at = stream.index("COPY recovery_payload(doc) FROM STDIN WITH (FORMAT csv);")
        terminator_at = stream.index("\\.", copy_at)
        csv_at = stream.index('"Client"', copy_at)
        insert_at = stream.index('INSERT INTO public."Client"', terminator_at)
        self.assertLess(copy_at, csv_at)
        self.assertLess(csv_at, terminator_at)
        self.assertLess(terminator_at, insert_at)

    def test_planning_queries_are_readonly_and_do_not_create_functions(self):
        query = recovery._capture_sql(["Client"])
        self.assertNotIn("CREATE ", query.upper())
        self.assertNotIn("FUNCTION", query.upper())
        self.assertIn("READ ONLY", "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;" + query)
        self.assertIn("default_transaction_read_only=on", recovery._docker_shell(True))

    def test_capture_sql_binds_rows_schema_and_digest_in_one_readonly_query(self):
        query = recovery._capture_sql(["Client"], ["Client", "Product"])
        self.assertIn("fullTarget", query)
        self.assertIn("master_rows", query)
        self.assertIn("schema", query)
        self.assertIn("digest", query)
        self.assertIn("Client", query)

    def test_exact_full_row_preservation_not_json_containment(self):
        sql = render_atomic_sql({t: [] for t in recovery.ALLOWED_TABLES}, recovery.TABLE_COLUMNS,
                                "a" * 32, "b" * 32, {t: 0 for t in recovery.ALLOWED_TABLES})
        self.assertIn("IS NOT DISTINCT FROM", sql)
        self.assertNotIn("current_rows @>", sql)

    def test_schema_requires_exact_supported_columns_and_metadata(self):
        schema = recovery.synthetic_schema()
        recovery.validate_schema(schema, schema)
        drift = {key: list(value) for key, value in schema.items()}
        drift["Client"] = [dict(col) for col in schema["Client"]]
        drift["Client"][0]["type"] = "varchar(999)"
        with self.assertRaises(ValueError):
            recovery.validate_schema(schema, drift)
        unsupported = {key: list(value) for key, value in schema.items()}
        unsupported["Client"] = unsupported["Client"] + [{"name": "extra", "type": "text", "nullable": True, "default": None}]
        with self.assertRaises(ValueError):
            recovery.validate_schema(unsupported, unsupported)
        enum_drift = {key: [dict(col) for col in value] for key, value in schema.items()}
        enum_drift["Client"][0]["enumLabels"] = ["ALTERED"]
        with self.assertRaises(ValueError):
            recovery.validate_schema(schema, enum_drift)
        with self.assertRaises(ValueError):
            recovery.validate_schema(schema, schema, [], [])

    def test_source_coverage_assertions_generated(self):
        plan = build_plan([{"id": "c", "rut": "r", "merlinCode": None}], [], [], [], [], [], [])
        sql = render_atomic_sql(plan.payload(), recovery.TABLE_COLUMNS,
                                "a" * 32, "b" * 32, plan.additions,
                                source_coverage=plan.source_coverage)
        self.assertIn("source identity not represented", sql)
        self.assertIn("source link absent", sql)

    def test_apply_result_classification(self):
        self.assertEqual(recovery.classify_apply_result(0, "RECOVERY_COMMITTED"), "committed")
        self.assertEqual(recovery.classify_apply_result(None, ""), "uncertain")
        self.assertEqual(recovery.classify_apply_result(1, ""), "uncertain")
        self.assertEqual(recovery.classify_postcommit_verification(False), "committed_verification_uncertain")

    def test_parent_candidate_and_live_modes_are_explicit(self):
        recovery.validate_apply_mode(candidate=True, execute=True, live=False,
                                     expected_source=None, expected_target=None)
        with self.assertRaises(ValueError):
            recovery.validate_apply_mode(candidate=False, execute=True, live=True,
                                         expected_source=None, expected_target=None)


if __name__ == "__main__":
    unittest.main()
