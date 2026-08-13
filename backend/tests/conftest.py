import pytest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
