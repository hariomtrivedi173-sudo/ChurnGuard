import asyncio
import sys
import os
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

_ml_dir = os.path.dirname(__file__)
_backend_dir = os.path.join(_ml_dir, '..', 'backend')

if _ml_dir not in sys.path:
    sys.path.insert(0, _ml_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from ml.prepare_data import load_data, prepare_features

SEGMENT_FEATURES = ["tenure", "MonthlyCharges", "TotalCharges"]


def find_best_k(X_scaled, k_range=range(2, 9)):
    print("Testing different numbers of clusters (Elbow Method):")
    print(f"{'K':<6}{'Inertia (lower = tighter clusters)'}")
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        km.fit(X_scaled)
        print(f"{k:<6}{km.inertia_:.2f}")


def segment_customers(df: pd.DataFrame, n_clusters: int = 4):
    X = df[SEGMENT_FEATURES]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df = df.copy()
    df["segment"] = kmeans.fit_predict(X_scaled)

    return df, kmeans, scaler


def profile_segments(df: pd.DataFrame):
    profile = df.groupby("segment").agg(
        customer_count=("segment", "count"),
        avg_tenure=("tenure", "mean"),
        avg_monthly_charges=("MonthlyCharges", "mean"),
        avg_total_charges=("TotalCharges", "mean"),
        churn_rate_percent=("Churn", lambda x: round(x.mean() * 100, 2)),
    ).round(2)
    return profile


async def get_segment_profiles():
    df = await load_data()
    if df.empty:
        return []
        
    df_prepared = prepare_features(df)
    df_segmented, _, _ = segment_customers(df_prepared, n_clusters=4)
    profile = profile_segments(df_segmented)
    
    # Convert DataFrame index 'segment' to a column and format as dicts
    profile = profile.reset_index()
    
    # Add descriptive names to segments based on K-Means common patterns
    # We will map segment index to names in the frontend, or we can do it here.
    # Let's just return the data, frontend will style it.
    return profile.to_dict(orient='records')



async def main():
    df = await load_data()
    df_prepared = prepare_features(df)

    X = df_prepared[SEGMENT_FEATURES]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    find_best_k(X_scaled)

    print("\nUsing K=4 for final segmentation...\n")
    df_segmented, kmeans_model, fitted_scaler = segment_customers(df_prepared, n_clusters=4)

    profile = profile_segments(df_segmented)
    print("Segment Profiles:")
    print(profile)


if __name__ == "__main__":
    asyncio.run(main())