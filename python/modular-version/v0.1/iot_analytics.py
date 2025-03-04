import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from supabase import create_client, Client
from dotenv import load_dotenv
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import dash
from dash import html, dcc
from dash.dependencies import Input, Output
from collections import defaultdict

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class IoTAnalytics:
    def __init__(self):
        self.supabase: Client = None
        self.data_cache = defaultdict(lambda: defaultdict(list))
        self.app = dash.Dash(__name__)
        self.setup_dashboard()

    def connect_to_db(self) -> None:
        """Establish Supabase connection"""
        try:
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            if not supabase_url or not supabase_key:
                raise ValueError("Supabase credentials not found")
            
            self.supabase = create_client(supabase_url, supabase_key)
            logging.info("Successfully connected to Supabase")
        except Exception as e:
            logging.error(f"Error connecting to Supabase: {e}")
            raise

    def get_recent_data(self, minutes: int = 30) -> pd.DataFrame:
        """Fetch recent device status data from Supabase"""
        try:
            time_threshold = (datetime.now() - timedelta(minutes=minutes)).isoformat()
            response = self.supabase.table('device_data')\
                .select('*')\
                .eq('data_type', 'status')\
                .gte('timestamp', time_threshold)\
                .execute()
            
            if not response.data:
                return pd.DataFrame()
            
            return pd.DataFrame(response.data)
        except Exception as e:
            logging.error(f"Error fetching recent data: {e}")
            return pd.DataFrame()

    def calculate_analytics(self, df: pd.DataFrame) -> Dict:
        """Calculate real-time analytics from status data"""
        if df.empty:
            return {}

        values = df['value'].astype(float)
        uptime_ratio = (values.sum() / len(values)) * 100

        return {
            'current_status': 'Online' if float(df.iloc[-1]['value']) == 1 else 'Offline',
            'uptime_percentage': f"{uptime_ratio:.2f}%",
            'status_changes': str(len(values[values.diff() != 0])),
            'last_update': df.iloc[-1]['timestamp']
        }

    def setup_dashboard(self):
        """Setup the Dash dashboard layout"""
        self.app.layout = html.Div([
            html.H1('Device Status Monitor', style={'textAlign': 'center', 'marginBottom': '20px'}),
            html.Div([
                dcc.Graph(id='status-graph', style={'height': '400px'}),
                dcc.Interval(
                    id='interval-component',
                    interval=5*1000,  # Update every 5 seconds
                    n_intervals=0
                ),
                html.Div(id='analytics-container', style={
                    'marginTop': '20px',
                    'padding': '20px',
                    'backgroundColor': '#f8f9fa',
                    'borderRadius': '8px',
                    'boxShadow': '0 2px 4px rgba(0,0,0,0.1)'
                })
            ])
        ], style={'padding': '20px'})

        @self.app.callback(
            [Output('status-graph', 'figure'),
             Output('analytics-container', 'children')],
            [Input('interval-component', 'n_intervals')]
        )
        def update_graph(n):
            df = self.get_recent_data()
            if df.empty:
                return {}, html.Div('No data available', style={'textAlign': 'center'})

            # Create status timeline
            fig = go.Figure()
            fig.add_trace(
                go.Bar(
                    x=df['timestamp'],
                    y=df['value'].astype(float),
                    name='Device Status',
                    marker_color=['#ff0000' if v == 0 else '#00ff00' for v in df['value'].astype(float)]
                )
            )

            fig.update_layout(
                title='Device Status Timeline',
                xaxis=dict(title='Timestamp'),
                yaxis=dict(
                    title='Status',
                    ticktext=['Offline', 'Online'],
                    tickvals=[0, 1],
                    range=[-0.1, 1.1]
                ),
                showlegend=False,
                margin=dict(l=50, r=50, t=50, b=50),
                height=400
            )

            # Calculate analytics
            analytics = self.calculate_analytics(df)
            
            # Create analytics display
            analytics_div = html.Div([
                html.H3('Status Analytics', style={'textAlign': 'center', 'color': '#2c3e50', 'marginBottom': '20px'}),
                html.Div([
                    html.Div([
                        html.Strong('Current Status: '),
                        html.Span(
                            analytics['current_status'],
                            style={'color': '#00ff00' if analytics['current_status'] == 'Online' else '#ff0000'}
                        )
                    ], style={'marginBottom': '10px'}),
                    html.Div([
                        html.Strong('Uptime: '),
                        html.Span(analytics['uptime_percentage'])
                    ], style={'marginBottom': '10px'}),
                    html.Div([
                        html.Strong('Status Changes: '),
                        html.Span(analytics['status_changes'])
                    ], style={'marginBottom': '10px'}),
                    html.Div([
                        html.Strong('Last Update: '),
                        html.Span(analytics['last_update'])
                    ])
                ])
            ])

            return fig, analytics_div

    def run(self, host: str = '0.0.0.0', port: int = 8050):
        """Run the analytics dashboard"""
        try:
            self.connect_to_db()
            logging.info(f"Starting dashboard on http://{host}:{port}")
            self.app.run_server(host=host, port=port, debug=True)
        except KeyboardInterrupt:
            logging.info("Stopping analytics dashboard...")

if __name__ == "__main__":
    analytics = IoTAnalytics()
    analytics.run()