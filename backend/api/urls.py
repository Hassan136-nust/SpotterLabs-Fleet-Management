from django.urls import path
from .views import PlanTripAPIView, HistoryAPIView

urlpatterns = [
    path('plan-trip/', PlanTripAPIView.as_view(), name='plan-trip'),
    path('history/', HistoryAPIView.as_view(), name='history'),
]
