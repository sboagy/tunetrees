"""Tests for FSRS optimization functionality."""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from typing import List, Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tunetrees.app.schedule import (
    optimize_fsrs_parameters,
    create_tuned_scheduler,
    get_user_review_history,
)
from tunetrees.models.tunetrees_pydantic import AlgorithmType
from tunetrees.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_db() -> MagicMock:
    """Create mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def mock_practice_records() -> List[Any]:
    """Create mock practice records for testing."""
    records = []
    base_time = datetime.now(timezone.utc)

    for i in range(15):  # Create enough records for optimization
        record = MagicMock()
        record.id = i + 1
        record.practiced = base_time.strftime("%Y-%m-%d %H:%M:%S")
        record.review_date = (base_time).strftime("%Y-%m-%d %H:%M:%S")
        record.quality = 3 + (i % 3)  # Vary quality between 3-5
        records.append(record)

    return records


class TestGetUserReviewHistory:
    """Test the get_user_review_history function."""

    @patch("tunetrees.app.schedule.select")
    def test_get_user_review_history_success(
        self, mock_select: Any, mock_db: Any, mock_practice_records: Any
    ) -> None:
        """Test successful retrieval of user review history."""
        # Mock database query
        mock_stmt = MagicMock()
        mock_select.return_value = mock_stmt
        mock_stmt.join.return_value = mock_stmt
        mock_stmt.where.return_value = mock_stmt
        mock_stmt.order_by.return_value = mock_stmt
        mock_stmt.limit.return_value = mock_stmt

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_practice_records
        mock_db.execute.return_value = mock_result

        # Test the function
        result = get_user_review_history(mock_db, "test_user", limit=20)

        # Assertions
        assert len(result) == 15
        assert all(hasattr(log, "card_id") for log in result)
        assert all(hasattr(log, "rating") for log in result)
        assert all(hasattr(log, "review_datetime") for log in result)

    @patch("tunetrees.app.schedule.select")
    def test_get_user_review_history_empty(
        self, mock_select: Any, mock_db: Any
    ) -> None:
        """Test with no practice records."""
        # Mock empty result
        mock_stmt = MagicMock()
        mock_select.return_value = mock_stmt
        mock_stmt.join.return_value = mock_stmt
        mock_stmt.where.return_value = mock_stmt
        mock_stmt.order_by.return_value = mock_stmt
        mock_stmt.limit.return_value = mock_stmt

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        result = get_user_review_history(mock_db, "test_user")
        assert len(result) == 0

    @patch("tunetrees.app.schedule.select")
    def test_get_user_review_history_invalid_records(
        self, mock_select: Any, mock_db: Any
    ) -> None:
        """Test with invalid practice records."""
        # Create invalid records
        invalid_record = MagicMock()
        invalid_record.id = 1
        invalid_record.practiced = None  # Invalid
        invalid_record.review_date = None
        invalid_record.quality = None

        mock_stmt = MagicMock()
        mock_select.return_value = mock_stmt
        mock_stmt.join.return_value = mock_stmt
        mock_stmt.where.return_value = mock_stmt
        mock_stmt.order_by.return_value = mock_stmt
        mock_stmt.limit.return_value = mock_stmt

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [invalid_record]
        mock_db.execute.return_value = mock_result

        result = get_user_review_history(mock_db, "test_user")
        assert len(result) == 0  # Invalid records should be skipped


class TestOptimizeFsrsParameters:
    """Test the optimize_fsrs_parameters function."""

    @patch("tunetrees.app.schedule.get_user_review_history")
    @patch("tunetrees.app.schedule.Optimizer")
    def test_optimize_fsrs_parameters_success(
        self, mock_optimizer_class: Any, mock_get_history: Any, mock_db: Any
    ) -> None:
        """Test successful FSRS parameter optimization."""
        # Mock review history with sufficient data
        mock_review_logs = [MagicMock() for _ in range(15)]
        mock_get_history.return_value = mock_review_logs

        # Mock optimizer
        mock_optimizer = MagicMock()
        mock_optimizer.compute_optimal_parameters.return_value = [
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
        ]
        mock_optimizer_class.return_value = mock_optimizer

        # Test the function
        params, loss = optimize_fsrs_parameters(
            mock_db, "test_user", AlgorithmType.FSRS
        )

        # Assertions
        assert isinstance(params, tuple)
        assert len(params) == 5
        assert params == (0.1, 0.2, 0.3, 0.4, 0.5)
        assert loss == 0.0
        mock_optimizer_class.assert_called_once_with(mock_review_logs)
        mock_optimizer.compute_optimal_parameters.assert_called_once()

    @patch("tunetrees.app.schedule.get_user_review_history")
    @patch("tunetrees.app.schedule.Scheduler")
    def test_optimize_fsrs_parameters_insufficient_data(
        self, mock_scheduler_class: Any, mock_get_history: Any, mock_db: Any
    ) -> None:
        """Test with insufficient review history."""
        # Mock insufficient review history
        mock_get_history.return_value = [MagicMock() for _ in range(5)]  # Less than 10

        # Mock default scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.parameters = (
            0.4,
            0.9,
            2.3,
            10.9,
            4.93,
            1.0,
            0.94,
            0.86,
            1.01,
            1.49,
            0.14,
            1.74,
            0.0,
            1.46,
            1.66,
            0.24,
            1.0,
        )
        mock_scheduler_class.return_value = mock_scheduler

        # Test the function
        params, loss = optimize_fsrs_parameters(
            mock_db, "test_user", AlgorithmType.FSRS
        )

        # Should return default parameters
        assert isinstance(params, tuple)
        assert len(params) > 0
        assert loss == 0.0

    @patch("tunetrees.app.schedule.get_user_review_history")
    @patch("tunetrees.app.schedule.Optimizer")
    @patch("tunetrees.app.schedule.Scheduler")
    def test_optimize_fsrs_parameters_optimization_error(
        self,
        mock_scheduler_class: Any,
        mock_optimizer_class: Any,
        mock_get_history: Any,
        mock_db: Any,
    ) -> None:
        """Test error handling during optimization."""
        # Mock review history
        mock_get_history.return_value = [MagicMock() for _ in range(15)]

        # Mock optimizer that raises an exception
        mock_optimizer = MagicMock()
        mock_optimizer.compute_optimal_parameters.side_effect = Exception(
            "Optimization failed"
        )
        mock_optimizer_class.return_value = mock_optimizer

        # Mock default scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.parameters = (
            0.4,
            0.9,
            2.3,
            10.9,
            4.93,
            1.0,
            0.94,
            0.86,
            1.01,
            1.49,
            0.14,
            1.74,
            0.0,
            1.46,
            1.66,
            0.24,
            1.0,
        )
        mock_scheduler_class.return_value = mock_scheduler

        # Test the function
        params, loss = optimize_fsrs_parameters(
            mock_db, "test_user", AlgorithmType.FSRS
        )

        # Should return default parameters on error
        assert isinstance(params, tuple)
        assert len(params) > 0
        assert loss == 0.0


class TestCreateTunedScheduler:
    """Test the create_tuned_scheduler function."""

    @patch("tunetrees.app.schedule.optimize_fsrs_parameters")
    @patch("tunetrees.app.schedule.save_prefs_spaced_repetition")
    @patch("tunetrees.app.schedule.Scheduler")
    def test_create_tuned_scheduler_with_optimization(
        self,
        mock_scheduler_class: Any,
        mock_save_prefs: Any,
        mock_optimize: Any,
        mock_db: Any,
    ) -> None:
        """Test creating a tuned scheduler with optimization."""
        # Mock optimization results
        optimized_params = (
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
            0.6,
            0.7,
            0.8,
            0.9,
            1.0,
            1.1,
            1.2,
            1.3,
            1.4,
            1.5,
            1.6,
            1.7,
        )
        mock_optimize.return_value = (optimized_params, 0.1)

        # Mock scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.parameters = optimized_params
        mock_scheduler.desired_retention = 0.9
        mock_scheduler.maximum_interval = 36500
        mock_scheduler.enable_fuzzing = True
        mock_scheduler_class.return_value = mock_scheduler

        # Test the function
        scheduler = create_tuned_scheduler(
            mock_db, "test_user", AlgorithmType.FSRS, force_optimization=True
        )

        # Assertions
        assert scheduler == mock_scheduler
        mock_optimize.assert_called_once_with(mock_db, "test_user", AlgorithmType.FSRS)
        mock_save_prefs.assert_called_once()
        mock_scheduler_class.assert_called_once()

    @patch("tunetrees.app.schedule.get_prefs_spaced_repetition")
    @patch("tunetrees.app.schedule.Scheduler")
    def test_create_tuned_scheduler_existing_preferences(
        self, mock_scheduler_class: Any, mock_get_prefs: Any, mock_db: Any
    ) -> None:
        """Test creating scheduler with existing preferences."""
        # Mock existing preferences
        mock_prefs = MagicMock()
        mock_prefs.fsrs_weights = "[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]"
        mock_prefs.request_retention = 0.9
        mock_prefs.maximum_interval = 36500
        mock_prefs.enable_fuzz = True
        mock_get_prefs.return_value = mock_prefs

        # Mock scheduler
        mock_scheduler = MagicMock()
        mock_scheduler_class.return_value = mock_scheduler

        # Test the function
        scheduler = create_tuned_scheduler(mock_db, "test_user", AlgorithmType.FSRS)

        # Assertions
        assert scheduler == mock_scheduler
        mock_get_prefs.assert_called_once_with(mock_db, "test_user", AlgorithmType.FSRS)
        mock_scheduler_class.assert_called_once()


class TestFsrsOptimizationAPI:
    """Test the FSRS optimization API endpoints."""

    @patch("tunetrees.api.preferences.SessionLocal")
    @patch("tunetrees.api.preferences.get_user_review_history")
    @patch("tunetrees.api.preferences.optimize_fsrs_parameters")
    @patch("tunetrees.api.preferences.create_tuned_scheduler")
    def test_optimize_fsrs_endpoint_success(
        self,
        mock_create_scheduler: Any,
        mock_optimize: Any,
        mock_get_history: Any,
        mock_session_local: Any,
        client: TestClient,
    ) -> None:
        """Test successful FSRS optimization endpoint."""
        # Mock session
        mock_db = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_db

        # Mock review history
        mock_get_history.return_value = [MagicMock() for _ in range(15)]

        # Mock optimization
        optimized_params = (
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
            0.6,
            0.7,
            0.8,
            0.9,
            1.0,
            1.1,
            1.2,
            1.3,
            1.4,
            1.5,
            1.6,
            1.7,
        )
        mock_optimize.return_value = (optimized_params, 0.1)

        # Mock scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.desired_retention = 0.9
        mock_scheduler.maximum_interval = 36500
        mock_scheduler.enable_fuzzing = True
        mock_create_scheduler.return_value = mock_scheduler

        # Test the endpoint
        response = client.post("/preferences/optimize_fsrs?user_id=1&alg_type=FSRS")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "FSRS optimization completed successfully"
        assert data["user_id"] == 1
        assert data["algorithm"] == "FSRS"
        assert data["review_count"] == 15
        assert data["loss"] == 0.1
        assert data["optimized_parameters"] == list(optimized_params)

    @patch("tunetrees.api.preferences.SessionLocal")
    @patch("tunetrees.api.preferences.get_user_review_history")
    def test_optimize_fsrs_endpoint_insufficient_data(
        self, mock_get_history: Any, mock_session_local: Any, client: TestClient
    ) -> None:
        """Test FSRS optimization with insufficient data."""
        # Mock session
        mock_db = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_db

        # Mock insufficient review history - this should trigger the HTTPException
        mock_get_history.return_value = [MagicMock() for _ in range(5)]

        # Test the endpoint
        response = client.post("/preferences/optimize_fsrs?user_id=1")

        # Assertions - the HTTPException should be raised and handled by FastAPI
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Insufficient review history" in detail
        assert "5 records" in detail

    @patch("tunetrees.api.preferences.SessionLocal")
    @patch("tunetrees.api.preferences.create_tuned_scheduler")
    def test_create_tuned_scheduler_endpoint_success(
        self, mock_create_scheduler: Any, mock_session_local: Any, client: TestClient
    ) -> None:
        """Test successful scheduler creation endpoint."""
        # Mock session
        mock_db = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_db

        # Mock scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.parameters = (
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
            0.6,
            0.7,
            0.8,
            0.9,
            1.0,
            1.1,
            1.2,
            1.3,
            1.4,
            1.5,
            1.6,
            1.7,
        )
        mock_scheduler.desired_retention = 0.9
        mock_scheduler.maximum_interval = 36500
        mock_scheduler.enable_fuzzing = True
        mock_create_scheduler.return_value = mock_scheduler

        # Test the endpoint
        response = client.post("/preferences/create_tuned_scheduler?user_id=1")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Tuned scheduler created successfully"
        assert data["user_id"] == 1
        assert data["algorithm"] == "FSRS"
        assert "scheduler_config" in data
        assert data["scheduler_config"]["parameters"] == list(mock_scheduler.parameters)
        assert data["scheduler_config"]["desired_retention"] == 0.9

    @patch("tunetrees.api.preferences.SessionLocal")
    @patch("tunetrees.api.preferences.create_tuned_scheduler")
    def test_create_tuned_scheduler_endpoint_error(
        self, mock_create_scheduler: Any, mock_session_local: Any, client: TestClient
    ) -> None:
        """Test scheduler creation endpoint with error."""
        # Mock session
        mock_db = MagicMock()
        mock_session_local.return_value.__enter__.return_value = mock_db

        # Mock error
        mock_create_scheduler.side_effect = Exception("Scheduler creation failed")

        # Test the endpoint
        response = client.post("/preferences/create_tuned_scheduler?user_id=1")

        # Assertions
        assert response.status_code == 500
        assert "Error creating tuned scheduler" in response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__])
