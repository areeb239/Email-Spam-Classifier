FROM python:3.13.7

WORKDIR /Spam_classifier

COPY .  .

RUN pip install -r requirement.txt
EXPOSE 8000

CMD [ "uvicorn","bacend:app","--host","0.0.0.0","--port","8000"  ]