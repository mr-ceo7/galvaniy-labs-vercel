"""Tests for Stage 6: Rate Limiter."""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.rate_limiter import (
    check_rate_limit,
    increment_rate_limit,
    get_daily_count,
    reset_rate_limits,
)


class TestRateLimiter:
    """Test the server-side rate limiter."""

    def setup_method(self):
        """Reset rate limits before each test."""
        reset_rate_limits()

    def test_first_request_allowed(self):
        """First request should always be allowed."""
        assert check_rate_limit("user-1", 3) is True

    def test_within_limit(self):
        """Requests within limit should be allowed."""
        increment_rate_limit("user-1")
        increment_rate_limit("user-1")
        assert check_rate_limit("user-1", 3) is True

    def test_at_limit(self):
        """Request at limit should be denied."""
        increment_rate_limit("user-1")
        increment_rate_limit("user-1")
        increment_rate_limit("user-1")
        assert check_rate_limit("user-1", 3) is False

    def test_over_limit(self):
        """Requests over limit should be denied."""
        for _ in range(5):
            increment_rate_limit("user-1")
        assert check_rate_limit("user-1", 3) is False

    def test_different_users_independent(self):
        """Rate limits should be per-user."""
        for _ in range(3):
            increment_rate_limit("user-1")
        assert check_rate_limit("user-1", 3) is False
        assert check_rate_limit("user-2", 3) is True

    def test_get_daily_count_zero(self):
        """Count should be 0 for new user."""
        assert get_daily_count("new-user") == 0

    def test_get_daily_count_after_increment(self):
        """Count should reflect increments."""
        increment_rate_limit("user-1")
        increment_rate_limit("user-1")
        assert get_daily_count("user-1") == 2

    def test_increment_returns_count(self):
        """Increment should return the new count."""
        assert increment_rate_limit("user-1") == 1
        assert increment_rate_limit("user-1") == 2
        assert increment_rate_limit("user-1") == 3

    def test_reset_clears_all(self):
        """Reset should clear all rate limits."""
        increment_rate_limit("user-1")
        increment_rate_limit("user-2")
        reset_rate_limits()
        assert get_daily_count("user-1") == 0
        assert get_daily_count("user-2") == 0

    def test_zero_limit(self):
        """Zero limit should deny even first request."""
        assert check_rate_limit("user-1", 0) is False
